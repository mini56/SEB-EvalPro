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
// reformule ce texte. Si l'IA n'est pas disponible ou échoue, la référence
// déterministe reste affichée et modifiable par l'administrateur.
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
#seb-generate-synthese:disabled{opacity:.6;cursor:wait}
@media print{#seb-ai-human-check{display:none!important}}
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
function installUnifiedSynthesis(){
 const area=document.getElementById('seb-bilan-synthese-text'),host=document.getElementById('seb-bilan-synthese'),engine=document.getElementById('seb-generate-synthese');
 if(!area||!host||!engine||document.getElementById('seb-ai-human-check'))return;
 engine.id='seb-generate-synthese-engine';engine.style.display='none';engine.setAttribute('aria-hidden','true');
 const button=engine.cloneNode(true);button.id='seb-generate-synthese';button.style.display='';button.removeAttribute('aria-hidden');button.textContent='Générer la synthèse';engine.insertAdjacentElement('afterend',button);
 const warning=document.createElement('p');warning.id='seb-ai-human-check';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';area.insertAdjacentElement('afterend',warning);
 const status=document.getElementById('seb-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 button.addEventListener('click',async()=>{
  button.disabled=true;setStatus('Génération de la synthèse de référence…');
  try{
   engine.click();
   const deterministic=aiText(area.value);
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');return}
   sessionStorage.setItem(SOURCE_KEY,deterministic);
   sessionStorage.setItem(FINAL_KEY,deterministic);
   setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await window.sebEvalPro?.localAiStatus?.();
    if(!st?.available){setStatus('Synthèse générée sans IA — '+(st?.error||'SEB-IA indisponible.'));return}
    const answer=await window.sebEvalPro.rewriteSynthesisLocal(deterministic);
    if(!answer?.ok){setStatus('Synthèse générée sans IA — '+(answer?.error||'SEB-IA indisponible.'));return}
    const finalText=stripAiWrappers(answer.text);
    if(!finalText){setStatus('Synthèse générée sans IA — la reformulation IA était vide.');return}
    area.value=finalText;sessionStorage.setItem(FINAL_KEY,finalText);area.dispatchEvent(new Event('input',{bubbles:true}));window.sebEvalPro?.save?.();
    if(answer.fallback) setStatus('Synthèse générée — SEB-IA a conservé le texte de référence après contrôle de fidélité.');
    else setStatus('Synthèse générée avec SEB-IA en '+Math.max(1,Math.round((answer.elapsedMs||0)/1000))+' s — relisez-la avant utilisation.');
   }catch(error){setStatus('Synthèse générée sans IA — '+String(error?.message||error))}
  }finally{button.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installUnifiedSynthesis,260),{once:true});else setTimeout(installUnifiedSynthesis,260);
})();
</script>
`;
  html = html.slice(0, end) + block + html.slice(end);
  checkHtml(html);
  write(adminFile, html);
}

// -----------------------------------------------------------------------------
// Anciens bilans : même fonctionnement unifié. Un seul bouton visible génère
// la référence déterministe puis demande la reformulation locale. Le champ
// historique reste éditable et reçoit directement le résultat final.
// -----------------------------------------------------------------------------
{
  let js = read(historyFile);
  if (!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9')) fail('V9 historique absent');
  if (js.includes('SEB_HISTORY_LOCAL_AI_UNIFIED')) fail('interface IA historique unifiée déjà injectée');

  const addon = String.raw`

// SEB_HISTORY_LOCAL_AI_UNIFIED
function sebBhInstallUnifiedSynthesis(){
 const summary=document.querySelector('#seb-bh-history-summary'),engine=document.querySelector('#seb-bh-gen-summary');
 if(!summary||!engine||document.querySelector('#seb-bh-ai-human-check'))return;
 engine.id='seb-bh-gen-summary-engine';engine.style.display='none';engine.setAttribute('aria-hidden','true');
 const btn=engine.cloneNode(true);btn.id='seb-bh-gen-summary';btn.style.display='';btn.removeAttribute('aria-hidden');btn.textContent='Générer la synthèse';engine.insertAdjacentElement('afterend',btn);
 const warning=document.createElement('p');warning.id='seb-bh-ai-human-check';warning.style.cssText='margin:7px 0 0;font:12px Calibri,Arial,sans-serif;color:#666';warning.innerHTML='<strong>SEB-IA peut faire des erreurs.</strong> Vérifiez les informations importantes.';summary.insertAdjacentElement('afterend',warning);
 let status=document.querySelector('#seb-bh-summary-status')||document.querySelector('#seb-bh-synthese-status');
 const setStatus=t=>{if(status)status.textContent=t};
 btn.addEventListener('click',async()=>{
  btn.disabled=true;setStatus('Génération de la synthèse de référence…');
  try{
   engine.click();
   const deterministic=String(summary.value||'').replace(/\r\n/g,'\n').trim();
   if(!deterministic){setStatus('Aucune synthèse n’a pu être générée.');return}
   setStatus('SEB-IA reformule la synthèse localement…');
   try{
    const st=await ipcRenderer.invoke('ai:status');
    if(!st?.available){setStatus('Synthèse générée sans IA — '+(st?.error||'SEB-IA indisponible.'));return}
    const answer=await ipcRenderer.invoke('ai:rewrite-synthesis',deterministic);
    if(!answer?.ok){setStatus('Synthèse générée sans IA — '+(answer?.error||'SEB-IA indisponible.'));return}
    let finalText=String(answer.text||'').replace(/\r\n/g,'\n').trim();
    finalText=finalText.replace(/^\s*<\/?(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*/i,'').replace(/\s*<\/(?:bilan_reformule|bilan_source|texte_source|proposition)>\s*$/i,'').trim();
    if(!finalText){setStatus('Synthèse générée sans IA — la reformulation IA était vide.');return}
    summary.value=finalText;summary.dispatchEvent(new Event('input',{bubbles:true}));
    if(answer.fallback)setStatus('Synthèse générée — SEB-IA a conservé le texte de référence après contrôle de fidélité.');
    else setStatus('Synthèse générée avec SEB-IA en '+Math.max(1,Math.round((answer.elapsedMs||0)/1000))+' s — relisez-la avant utilisation.');
   }catch(error){setStatus('Synthèse générée sans IA — '+String(error?.message||error))}
  }finally{btn.disabled=false}
 });
}
(function sebBhWatchUnifiedSynthesis(){
 const install=()=>setTimeout(sebBhInstallUnifiedSynthesis,80);
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

console.log('SEB EvalPro IA locale prototype: synthèse déterministe + SEB-IA réunies dans une seule zone, avec un seul bouton et relecture humaine explicite.');
