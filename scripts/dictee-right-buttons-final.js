const fs=require('fs'),path=require('path');
const target=path.resolve(__dirname,'..','app','web','dictee.html');
function fail(m){console.error('SEB EvalPro dictée boutons: '+m);process.exit(2)}
if(!fs.existsSync(target))fail('dictee.html généré introuvable');
let html=fs.readFileSync(target,'utf8');
let disabled=0;
html=html.replace(/moveValidationButtonsLeft\(\);/g,()=>{disabled++;return '/* placement gauche désactivé : action principale centrée dans la page */';});
if(!disabled)fail('appel de placement gauche introuvable');
const runtime=String.raw`
<script id="seb-dictee-right-actions-final">
(()=>{
  'use strict';
  function place(){
    const verify=document.getElementById('verifyBtn');
    const next=document.getElementById('nextBtn');
    if(!verify||!next)return false;

    let box=document.getElementById('seb-dictee-centered-actions');
    if(!box){
      box=document.createElement('div');
      box.id='seb-dictee-centered-actions';
      box.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1001;display:flex;gap:10px;align-items:center;justify-content:center;padding:6px 10px;border-radius:9px;background:rgba(255,255,255,.96);box-shadow:0 2px 8px rgba(0,0,0,.18);';
      document.body.appendChild(box);
    }
    if(verify.parentElement!==box)box.appendChild(verify);
    if(next.parentElement!==box)box.appendChild(next);
    return true;
  }
  function init(){
    place();
    setTimeout(place,100);
    setTimeout(place,500);
    new MutationObserver(()=>requestAnimationFrame(place)).observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('resize',place);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>`;
html=html.replace(/<\/body>/i,runtime+'\n</body>');
if(!html.includes('seb-dictee-right-actions-final')||!html.includes('seb-dictee-centered-actions'))fail('runtime boutons centrés absent');
if(/right:12px;bottom:12px/.test(html))fail('ancien placement bas-droite encore présent');
fs.writeFileSync(target,html,'utf8');
console.log('SEB EvalPro dictée: « Dictée terminée » puis « Suivant » centrés en bas de la page.');
