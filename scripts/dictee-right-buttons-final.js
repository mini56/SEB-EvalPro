const fs=require('fs'),path=require('path');
const target=path.resolve(__dirname,'..','app','web','dictee.html');
function fail(m){console.error('SEB EvalPro dictée boutons: '+m);process.exit(2)}
if(!fs.existsSync(target))fail('dictee.html généré introuvable');
let html=fs.readFileSync(target,'utf8');
let disabled=0;
html=html.replace(/moveValidationButtonsLeft\(\);/g,()=>{disabled++;return '/* placement gauche désactivé : boutons sur zone texte droite */';});
if(!disabled)fail('appel de placement gauche introuvable');
const runtime=String.raw`
<script id="seb-dictee-right-actions-final">
(()=>{
  'use strict';
  function place(){
    const text=document.getElementById('candidateText');
    const verify=document.getElementById('verifyBtn');
    const next=document.getElementById('nextBtn');
    if(!text||!verify||!next)return false;
    let wrap=document.getElementById('seb-dictee-textarea-wrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='seb-dictee-textarea-wrap';
      wrap.style.cssText='position:relative;display:flex;flex:1;min-height:0;width:100%;';
      text.parentNode.insertBefore(wrap,text);wrap.appendChild(text);
      text.style.setProperty('flex','1','important');text.style.setProperty('width','100%','important');text.style.setProperty('padding-bottom','68px','important');
    }
    let box=document.getElementById('seb-dictee-right-actions');
    if(!box){
      box=document.createElement('div');box.id='seb-dictee-right-actions';
      box.style.cssText='position:absolute;right:12px;bottom:12px;z-index:30;display:flex;gap:10px;align-items:center;padding:6px;border-radius:9px;background:rgba(255,255,255,.94);box-shadow:0 2px 8px rgba(0,0,0,.18);';
      wrap.appendChild(box);
    }
    if(verify.parentElement!==box)box.appendChild(verify);if(next.parentElement!==box)box.appendChild(next);return true;
  }
  function init(){place();setTimeout(place,100);setTimeout(place,500);new MutationObserver(()=>requestAnimationFrame(place)).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('resize',place)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;
html=html.replace(/<\/body>/i,runtime+'\n</body>');
if(!html.includes('seb-dictee-right-actions-final')||!html.includes('seb-dictee-textarea-wrap'))fail('runtime boutons droite absent');
fs.writeFileSync(target,html,'utf8');
console.log('SEB EvalPro dictée: Vérifier et Suivant superposés en bas à droite de la zone texte.');
