const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const htmlFile=path.join(root,'app','web','admin-bilan.html');
const engineFile=path.join(root,'src','qwen-rich-synthesis.js');

function fail(m){console.error('SEB EvalPro Qwen direct: '+m);process.exit(2)}
if(!fs.existsSync(htmlFile))fail('admin-bilan.html généré introuvable');
if(!fs.existsSync(engineFile))fail('moteur contexte riche introuvable');

let html=fs.readFileSync(htmlFile,'utf8').replace(/\r\n/g,'\n');
const engine=fs.readFileSync(engineFile,'utf8').replace(/\r\n/g,'\n');
if(html.includes('seb-qwen-rich-context-ui')){console.log('SEB EvalPro Qwen direct: déjà injecté.');process.exit(0)}
if(!html.includes('seb-generate-synthese'))fail('bouton Générer introuvable');

const browserEngine=engine.replace(/^\s*if\s*\(typeof module[^\n]*module\.exports[^\n]*\n/m,'');
const block = '<script id="seb-qwen-rich-context-engine">\n' + browserEngine + '\n</script>\n' +
' <script id="seb-qwen-rich-context-ui">\n'.trimStart() +
`(()=>{
 'use strict';
 const KIND='seb-qwen-rich-context-v1';
 function candidate(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
 function rows(){
   const out={};
   for(const key of Object.keys(window.SebQwenRich.ROWS||{})){
     const r=document.querySelector('tr[data-r="'+key+'"]');
     out[key]=r?{
       level:String(r.querySelector('.level.on')?.dataset.l||''),
       select:String(r.querySelector('.csel')?.value||''),
       comment:String(r.querySelector('.ctxt')?.value||''),
       detail:String(r.querySelector('.detail')?.textContent||'')
     }:{};
   }
   return out;
 }
 window.sebQwenRichPayload=()=>{
   const profile=window.SebQwenRich.buildRichProfile({candidate:candidate(),rows:rows(),texte_loisir_optionnel:''});
   const payload={kind:KIND,profile};
   try{sessionStorage.setItem('seb_evalpro_qwen_rich_profile_v1',JSON.stringify(payload))}catch(_){ }
   window.sebQwenRichLastProfile=profile;
   return JSON.stringify(payload);
 };
})();
</script>`;

const end=html.toLowerCase().lastIndexOf('</body>');
if(end<0)fail('balise body introuvable');
html=html.slice(0,end)+block+html.slice(end);

const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while((m=re.exec(html))){
 if(/\bsrc\s*=/.test(m[1]||''))continue;
 const js=String(m[2]||'').trim();
 if(!js)continue;
 try{new vm.Script(js)}catch(e){fail('JavaScript inline invalide: '+e.message)}
}
fs.writeFileSync(htmlFile,html,'utf8');
console.log('SEB EvalPro: JSON Qwen fourni adapté au bilan courant sans ajout de contrôle métier.');
