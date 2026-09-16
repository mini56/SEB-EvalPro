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
// Bilan courant : conserver le #28 dans son champ, afficher la version IA dans
// un second champ séparé. Le prototype ne remplace donc jamais silencieusement
// le texte déterministe validé.
// -----------------------------------------------------------------------------
{
  let html = read(adminFile);
  if (!html.includes('seb-165plus-natural-synthesis-v9')) fail('moteur #28 / V9 absent');
  if (html.includes('seb-local-ai-comparison-prototype')) fail('prototype IA déjà injecté');
  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) fail('fin admin-bilan introuvable');

  const block = String.raw`
<style id="seb-local-ai-comparison-style">
#seb-local-ai-comparison-prototype{margin:12px 0 18px;border:1px solid #70ad47;background:#f7fff3;padding:14px}
#seb-local-ai-comparison-prototype h2{margin:0 0 5px;color:#385723;font-size:16pt}
#seb-local-ai-comparison-prototype .seb-ai-help{margin:0 0 10px;font:10pt Calibri,Arial,sans-serif;color:#444}
#seb-local-ai-comparison-prototype .seb-ai-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:9px}
#seb-local-ai-comparison-prototype button{border:0;border-radius:5px;background:#548235;color:#fff;padding:8px 13px;font-weight:700;cursor:pointer}
#seb-local-ai-comparison-prototype button:disabled{opacity:.6;cursor:wait}
#seb-local-ai-status{font:10pt Calibri,Arial,sans-serif;color:#385723}
#seb-local-ai-result{width:100%;min-height:220px;box-sizing:border-box;padding:9px;font:11pt Calibri,Arial,sans-serif;line-height:1.4;resize:vertical;border:1px solid #7f9e6d;background:#fff}
#seb-local-ai-result.seb-ai-error{border-color:#c00000;background:#fff6f6}
@media print{#seb-local-ai-comparison-prototype{display:none!important}}
</style>
<script id="seb-local-ai-comparison-prototype">
(()=>{'use strict';
const IA_SOURCE_KEY='seb_evalpro_ia_test_source',IA_RESULT_KEY='seb_evalpro_ia_test_result';
function aiText(v){return String(v||'').replace(/\r\n/g,'\n').trim()}
function installAiComparison(){
 const source=document.getElementById('seb-bilan-synthese-text'),host=document.getElementById('seb-bilan-synthese');
 if(!source||!host||document.getElementById('seb-local-ai-result'))return;
 const section=document.createElement('section');section.id='seb-local-ai-comparison-prototype';
 section.innerHTML='<h2>Comparaison avec l’IA locale — prototype</h2><p class="seb-ai-help">La synthèse ci-dessus reste la version sans IA #28. Le bouton ci-dessous la reformule avec le modèle embarqué sur ce PC, sans connexion Internet et sans modifier les résultats.</p><div class="seb-ai-actions"><button type="button" id="seb-local-ai-rewrite">Reformuler avec l’IA locale</button><span id="seb-local-ai-status">Vérification du moteur local…</span></div><textarea id="seb-local-ai-result" readonly placeholder="La version reformulée par l’IA locale apparaîtra ici."></textarea>';
 host.insertAdjacentElement('afterend',section);
 const button=section.querySelector('#seb-local-ai-rewrite'),status=section.querySelector('#seb-local-ai-status'),result=section.querySelector('#seb-local-ai-result');
 const savedSource=aiText(sessionStorage.getItem(IA_SOURCE_KEY)),savedResult=aiText(sessionStorage.getItem(IA_RESULT_KEY));if(savedSource&&savedResult&&savedSource===aiText(source.value))result.value=savedResult;
 const refreshStatus=async()=>{try{const st=await window.sebEvalPro?.localAiStatus?.();if(st?.available)status.textContent='IA locale prête — '+st.model+' — fonctionnement hors ligne.';else status.textContent=st?.error||'IA locale indisponible.'}catch(_){status.textContent='IA locale indisponible.'}};
 refreshStatus();
 source.addEventListener('input',()=>{if(aiText(source.value)!==aiText(sessionStorage.getItem(IA_SOURCE_KEY))){result.value='';sessionStorage.removeItem(IA_RESULT_KEY)}});
 button.addEventListener('click',async()=>{
  const original=aiText(source.value);result.classList.remove('seb-ai-error');if(!original){status.textContent='Générez d’abord la synthèse sans IA.';return}
  button.disabled=true;status.textContent='Chargement du modèle puis reformulation locale…';result.value='';
  try{
   const st=await window.sebEvalPro?.localAiStatus?.();if(!st?.available){status.textContent=st?.error||'IA locale indisponible.';result.classList.add('seb-ai-error');return}
   const answer=await window.sebEvalPro.rewriteSynthesisLocal(original);
   if(!answer?.ok){status.textContent='Échec IA locale : '+(answer?.error||'erreur inconnue');result.classList.add('seb-ai-error');return}
   result.value=aiText(answer.text);sessionStorage.setItem(IA_SOURCE_KEY,original);sessionStorage.setItem(IA_RESULT_KEY,result.value);window.sebEvalPro?.save?.();
   status.textContent='Reformulation terminée en '+Math.max(1,Math.round((answer.elapsedMs||0)/1000))+' s — '+answer.model+' — hors ligne.';
  }catch(error){status.textContent='Échec IA locale : '+String(error?.message||error);result.classList.add('seb-ai-error')}
  finally{button.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installAiComparison,260),{once:true});else setTimeout(installAiComparison,260);
})();
</script>
`;
  html = html.slice(0, end) + block + html.slice(end);
  checkHtml(html);
  write(adminFile, html);
}

// -----------------------------------------------------------------------------
// Anciens bilans : même comparaison dans l’éditeur historique. La version IA
// reste séparée et n’est pas enregistrée comme synthèse officielle pendant le
// prototype.
// -----------------------------------------------------------------------------
{
  let js = read(historyFile);
  if (!js.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9')) fail('V9 historique absent');
  if (js.includes('SEB_HISTORY_LOCAL_AI_COMPARISON')) fail('prototype IA historique déjà injecté');

  const addon = String.raw`

// SEB_HISTORY_LOCAL_AI_COMPARISON
function sebBhInstallLocalAiComparison(){
 const summary=document.querySelector('#seb-bh-history-summary');if(!summary||document.querySelector('#seb-bh-local-ai-result'))return;
 const host=summary.closest('section')||summary.parentElement;if(!host)return;
 const box=document.createElement('section');box.style.cssText='margin:12px 0;border:1px solid #70ad47;background:#f7fff3;padding:13px';
 box.innerHTML='<h2 style="margin:0 0 7px;color:#385723">Comparaison avec l’IA locale — prototype</h2><p style="margin:0 0 9px;font-size:12px;color:#444">La synthèse de l’ancien bilan reste inchangée. La version ci-dessous est une reformulation locale pour comparaison.</p><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px"><button type="button" id="seb-bh-local-ai-rewrite" style="background:#548235;color:#fff;border:0;border-radius:5px;padding:8px 13px;font-weight:700">Reformuler avec l’IA locale</button><span id="seb-bh-local-ai-status" style="font-size:12px;color:#385723">Vérification du moteur local…</span></div><textarea id="seb-bh-local-ai-result" readonly style="width:100%;min-height:200px;box-sizing:border-box;padding:9px;font:11pt Calibri,Arial;line-height:1.4;background:#fff" placeholder="La version IA locale apparaîtra ici."></textarea>';
 host.insertAdjacentElement('afterend',box);
 const btn=box.querySelector('#seb-bh-local-ai-rewrite'),status=box.querySelector('#seb-bh-local-ai-status'),result=box.querySelector('#seb-bh-local-ai-result');
 ipcRenderer.invoke('ai:status').then(st=>{status.textContent=st?.available?'IA locale prête — '+st.model+' — hors ligne.':(st?.error||'IA locale indisponible.')}).catch(()=>{status.textContent='IA locale indisponible.'});
 const gen=document.querySelector('#seb-bh-gen-summary');if(gen)gen.addEventListener('click',()=>{result.value='';status.textContent='Synthèse sans IA régénérée. Lancez la reformulation locale pour comparer.'});
 summary.addEventListener('input',()=>{result.value=''});
 btn.addEventListener('click',async()=>{
  const original=String(summary.value||'').replace(/\r\n/g,'\n').trim();if(!original){status.textContent='Générez d’abord la synthèse sans IA.';return}
  btn.disabled=true;result.value='';status.textContent='Chargement du modèle puis reformulation locale…';
  try{const answer=await ipcRenderer.invoke('ai:rewrite-synthesis',original);if(!answer?.ok){status.textContent='Échec IA locale : '+(answer?.error||'erreur inconnue');return}result.value=String(answer.text||'').trim();status.textContent='Reformulation terminée en '+Math.max(1,Math.round((answer.elapsedMs||0)/1000))+' s — '+answer.model+' — hors ligne.'}
  catch(error){status.textContent='Échec IA locale : '+String(error?.message||error)}finally{btn.disabled=false}
 });
}
(function sebBhWatchLocalAi(){
 const install=()=>setTimeout(sebBhInstallLocalAiComparison,80);
 const start=()=>{
  install();
  const root=document.documentElement||document.body;
  if(!root){setTimeout(start,50);return}
  const observer=new MutationObserver(()=>{if(document.querySelector('#seb-bh-history-summary')&&!document.querySelector('#seb-bh-local-ai-result'))install()});
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

console.log('SEB EvalPro IA locale prototype: comparaison #28 / reformulation IA locale installée, sans remplacement automatique du texte déterministe.');
