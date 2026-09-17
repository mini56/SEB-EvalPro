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
// Le bouton existant du moteur déterministe est conservé comme bouton unique :
// son gestionnaire produit d'abord la référence factuelle, puis ce gestionnaire
// ajoute la reformulation SEB-IA. Tous les anciens doublons sont supprimés.
// -----------------------------------------------------------------------------
{
  let html = read(adminFile);
  if (!html.includes('seb-165plus-natural-synthesis-v9')) fail('moteur #28 / V9 absent');
  if (html.includes('seb-local-ai-unified-prototype')) fail('interface IA unifiée déjà injectée');
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) fail('fin admin-bilan introuvable');

  const block = String.raw`
<style id="seb-local-ai-unified-style">
#seb-ai-human-check{margin:7px 0 0;font:10pt Calibri,Arial,sans-serif;color:#666}
#seb-ai-human-check strong{color:#444}
#seb-ai-result-status{margin:4px 0 0;font:700 10pt Calibri,Arial,sans-serif;color:#444}
#seb-generate-synthese:disabled{opacity:.6;cursor:wait}
@media print{#seb-ai-human-check,#seb-ai-result-status{display:none!important}}
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
 if(!area||!host||document.getElementById('seb-ai-human-check'))return;
 const buttons=[...host.querySelectorAll('button')].filter(synthesisButton);
 let engine=document.getElementById('seb-generate-synthese');
 if(!engine||!host.contains(engine))engine=buttons[0]||null;
 if(!engine)return;
 for(const old of buttons){if(old!==engine)old.remove()}
 engine.id='seb-generate-synthese';engine.style.display='';engine.removeAttribute('aria-hidden');engine.textContent='Générer la synthèse';engine.dataset.sebAiUnified='1';
 const warning=document.createElement('p');warning.id='seb-ai-human-check';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';area.insertAdjacentElement('afterend',warning);
 const aiState=document.createElement('p');aiState.id='seb-ai-result-status';aiState.setAttribute('role','status');aiState.textContent='SEB-IA : en attente de génération.';warning.insertAdjacentElement('afterend',aiState);
 const status=document.getElementById('seb-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 const setAiState=t=>{aiState.textContent=t};
 engine.addEventListener('click',async()=>{
  engine.disabled=true;setStatus('Génération de la synthèse de référence…');setAiState('SEB-IA : traitement en cours…');
  try{
   // Les gestionnaires déterministes déjà attachés au même bouton s'exécutent
   // dans ce clic. Ce microtask permet de lire ensuite leur texte final.
   await Promise.resolve();
   const deterministic=aiText(area.value);
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');setAiState('SEB-IA : aucun texte moteur disponible.');return}
   sessionStorage.setItem(SOURCE_KEY,deterministic);
   sessionStorage.setItem(FINAL_KEY,deterministic);
   setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await window.sebEvalPro?.localAiStatus?.();
    if(!st?.available){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — IA indisponible.');return}
    const answer=await window.sebEvalPro.rewriteSynthesisLocal(deterministic);
    if(!answer?.ok){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — '+(answer?.error||'reformulation indisponible.') );return}
    const finalText=stripAiWrappers(answer.text);
    if(!finalText){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — reformulation vide.');return}
    area.value=finalText;sessionStorage.setItem(FINAL_KEY,finalText);area.dispatchEvent(new Event('input',{bubbles:true}));window.sebEvalPro?.save?.();
    if(answer.fallback){
      setStatus('Synthèse moteur conservée après contrôle SEB-IA.');
      setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — contrôle de fidélité ('+passesLabel(answer.passes)+', '+elapsedLabel(answer.elapsedMs)+').');
    }else{
      setStatus('Synthèse reformulée avec SEB-IA.');
      setAiState('SEB-IA : REFORMULATION APPLIQUÉE — '+passesLabel(answer.passes)+', '+elapsedLabel(answer.elapsedMs)+'.');
    }
   }catch(error){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — '+String(error?.message||error))}
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
// Anciens bilans : même fonctionnement unifié et même indicateur explicite.
// Le bouton déterministe existant reste le seul bouton visible.
// -----------------------------------------------------------------------------
{
  let js = read(historyFile);
  if (!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9')) fail('V9 historique absent');
  if (js.includes('SEB_HISTORY_LOCAL_AI_UNIFIED')) fail('interface IA historique unifiée déjà injectée');

  const addon = String.raw`

// SEB_HISTORY_LOCAL_AI_UNIFIED
function sebBhInstallUnifiedSynthesis(){
 const summary=document.querySelector('#seb-bh-history-summary');
 if(!summary||document.querySelector('#seb-bh-ai-human-check'))return;
 const host=summary.closest('section')||summary.parentElement;
 if(!host)return;
 const isSynthButton=b=>{const id=String(b?.id||'');const text=String(b?.textContent||'').trim().toLocaleLowerCase('fr-FR');return id==='seb-bh-gen-summary'||id==='seb-bh-gen-summary-engine'||(text.includes('générer')&&text.includes('synthèse'))||(text.includes('regénérer')&&text.includes('synthèse'))||(text.includes('régénérer')&&text.includes('synthèse'))};
 const buttons=[...host.querySelectorAll('button')].filter(isSynthButton);
 let engine=document.querySelector('#seb-bh-gen-summary');if(!engine||!host.contains(engine))engine=buttons[0]||null;if(!engine)return;
 for(const old of buttons){if(old!==engine)old.remove()}
 engine.id='seb-bh-gen-summary';engine.style.display='';engine.removeAttribute('aria-hidden');engine.textContent='Générer la synthèse';engine.dataset.sebAiUnified='1';
 const warning=document.createElement('p');warning.id='seb-bh-ai-human-check';warning.style.cssText='margin:7px 0 0;font:12px Calibri,Arial,sans-serif;color:#666';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';summary.insertAdjacentElement('afterend',warning);
 const aiState=document.createElement('p');aiState.id='seb-bh-ai-result-status';aiState.setAttribute('role','status');aiState.style.cssText='margin:4px 0 0;font:700 12px Calibri,Arial,sans-serif;color:#444';aiState.textContent='SEB-IA : en attente de génération.';warning.insertAdjacentElement('afterend',aiState);
 let status=document.querySelector('#seb-bh-summary-status')||document.querySelector('#seb-bh-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 const setAiState=t=>{aiState.textContent=t};
 const elapsed=ms=>{const n=Math.max(0,Number(ms)||0);return n<1000?'< 1 s':Math.round(n/1000)+' s'};
 const passes=n=>{const v=Math.max(0,Number(n)||0);return v+' passe'+(v>1?'s':'')};
 engine.addEventListener('click',async()=>{
  engine.disabled=true;setStatus('Génération de la synthèse de référence…');setAiState('SEB-IA : traitement en cours…');
  try{
   await Promise.resolve();
   const deterministic=String(summary.value||'').replace(/\r\n/g,'\n').trim();
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');setAiState('SEB-IA : aucun texte moteur disponible.');return}
   setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await ipcRenderer.invoke('ai:status');
    if(!st?.available){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — IA indisponible.');return}
    const answer=await ipcRenderer.invoke('ai:rewrite-synthesis',deterministic);
    if(!answer?.ok){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — '+(answer?.error||'reformulation indisponible.'));return}
    let finalText=String(answer.text||'').replace(/\r\n/g,'\n').trim();
    finalText=finalText.replace(/^\s*<\/?(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*/i,'').replace(/\s*<\/(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*$/i,'').trim();
    if(!finalText){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — reformulation vide.');return}
    summary.value=finalText;summary.dispatchEvent(new Event('input',{bubbles:true}));
    if(answer.fallback){setStatus('Synthèse moteur conservée après contrôle SEB-IA.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — contrôle de fidélité ('+passes(answer.passes)+', '+elapsed(answer.elapsedMs)+').')}
    else{setStatus('Synthèse reformulée avec SEB-IA.');setAiState('SEB-IA : REFORMULATION APPLIQUÉE — '+passes(answer.passes)+', '+elapsed(answer.elapsedMs)+'.')}
   }catch(error){setStatus('Synthèse moteur conservée.');setAiState('SEB-IA : TEXTE MOTEUR CONSERVÉ — '+String(error?.message||error))}
  }finally{engine.disabled=false}
 });
}
(function sebBhWatchUnifiedSynthesis(){
 const install=()=>setTimeout(sebBhInstallUnifiedSynthesis,120);
 const start=()=>{
  install();
  const root=document.documentElement||document.body;
  if(!root){setTimeout(start,50);return}
  const observer=new MutationObserver(()=>{if(document.querySelector('#seb-bh-history-summary')&&!document.querySelector('#seb-bh-ai-human-check'))install()});
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

console.log('SEB EvalPro IA locale prototype: bouton unique « Générer la synthèse » et état explicite REFORMULATION APPLIQUÉE / TEXTE MOTEUR CONSERVÉ.');
