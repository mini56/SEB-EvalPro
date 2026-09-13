const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const dicteePath=path.join(root,'app','web','dictee.html');
const qcmPath=path.join(root,'app','web','qcmv1.0.html');
function fail(m){console.error('SEB EvalPro dictée déplacements v3: '+m);process.exit(2)}
if(!fs.existsSync(dicteePath)||!fs.existsSync(qcmPath))fail('pages générées introuvables');

const classifier=String.raw`
function sebClassifyAlignmentV3(alignment){
  const core=t=>String(t||'').normalize('NFC').replace(/\s*[.,;:!?…]+$/u,'').replace(/’/g,"'").toLowerCase();
  const dist=(a,b)=>{const l=Array.from(a||''),r=Array.from(b||'');let p=Array.from({length:r.length+1},(_,i)=>i);for(let i=1;i<=l.length;i++){const c=new Array(r.length+1);c[0]=i;for(let j=1;j<=r.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(l[i-1]===r[j-1]?0:1));p=c}return p[r.length]};
  const expected=[],actual=[],types={},assigned=new Map();
  alignment.forEach((item,index)=>{
    types[index]=item.type;
    if(item.type==='substitute'||item.type==='delete')expected.push({index,token:item.expected,used:false});
    if(item.type==='substitute'||item.type==='insert')actual.push({index,token:item.actual,used:false});
  });

  // 1) Déplacements exacts : on apparie d'abord les mêmes mots présents ailleurs.
  //    Le tri global par distance évite qu'un doublon lointain vole le bon partenaire.
  const movedCandidates=[];
  actual.forEach(a=>expected.forEach(e=>{
    const ac=core(a.token),ec=core(e.token),d=Math.abs(a.index-e.index);
    if(ac.length>=4&&ac===ec&&a.index!==e.index&&d<=16)movedCandidates.push({a,e,d});
  }));
  movedCandidates.sort((x,y)=>(x.d-y.d)||(x.a.index-y.a.index)||(x.e.index-y.e.index));
  movedCandidates.forEach(({a,e})=>{
    if(a.used||e.used)return;
    a.used=true;e.used=true;assigned.set(a.index,{type:'moved',expected:e.token});
  });

  // 2) Les substitutions qui restent à leur position d'origine restent des fautes.
  actual.forEach(a=>{
    if(a.used||types[a.index]!=='substitute')return;
    const e=expected.find(x=>x.index===a.index&&!x.used);
    if(!e)return;
    a.used=true;e.used=true;assigned.set(a.index,{type:'substitute',expected:e.token});
  });

  // 3) Un mot inséré très proche orthographiquement d'un mot attendu est une faute
  //    d'orthographe, pas un ajout + une omission artificiels (ex. envoie/envoi).
  actual.forEach(a=>{
    if(a.used)return;
    const ac=core(a.token),c=[];
    expected.forEach(e=>{
      if(e.used||Math.abs(e.index-a.index)>8)return;
      const ec=core(e.token),ratio=dist(ac,ec)/Math.max(ac.length,ec.length,1);
      if(ac.length>=3&&ec.length>=3&&ratio<=0.35)c.push({e,ratio,d:Math.abs(e.index-a.index)});
    });
    c.sort((x,y)=>(x.ratio-y.ratio)||(x.d-y.d));
    if(!c.length)return;
    a.used=true;c[0].e.used=true;assigned.set(a.index,{type:'substitute',expected:c[0].e.token});
  });

  actual.forEach(a=>{if(!a.used){a.used=true;assigned.set(a.index,{type:'insert',expected:''})}});
  const missing=new Map(expected.filter(e=>!e.used).map(e=>[e.index,e.token]));
  const items=[];
  alignment.forEach((item,index)=>{
    if(missing.has(index))items.push({type:'delete',expected:missing.get(index),actual:''});
    if(item.type==='match'){items.push({type:'match',expected:item.expected,actual:item.actual});return}
    if(!item.actual)return;
    const a=assigned.get(index)||{type:'insert',expected:''};
    items.push({type:a.type,expected:a.expected||'',actual:item.actual});
  });
  return{
    items,
    substitutions:items.filter(i=>i.type==='substitute').length,
    omissions:items.filter(i=>i.type==='delete').length,
    additions:items.filter(i=>i.type==='insert').length,
    moved:items.filter(i=>i.type==='moved').length
  };
}`;
try{new vm.Script(classifier)}catch(e){fail('classificateur invalide: '+e.message)}

// Cas réel complexe fourni par l'utilisateur :
// attendu « un remboursement rapide ou un nouvel envoi complet »
// saisi   « un nouvel envoi rapide ou un remboursement ».
const complex=[
  {type:'substitute',expected:'demandé',actual:'demmandé'},
  {type:'match',expected:'un',actual:'un'},
  {type:'substitute',expected:'remboursement',actual:'nouvel'},
  {type:'insert',expected:'',actual:'envoi'},
  {type:'match',expected:'rapide',actual:'rapide'},
  {type:'match',expected:'ou',actual:'ou'},
  {type:'match',expected:'un',actual:'un'},
  {type:'delete',expected:'nouvel',actual:''},
  {type:'delete',expected:'envoi',actual:''},
  {type:'substitute',expected:'complet.',actual:'remboursement.'}
];
const previous=[
  {type:'substitute',expected:'remboursement',actual:'nouvel'},
  {type:'insert',expected:'',actual:'envoie'},
  {type:'match',expected:'rapide',actual:'rapide'},
  {type:'match',expected:'ou',actual:'ou'},
  {type:'delete',expected:'un',actual:''},
  {type:'substitute',expected:'nouvel',actual:'le'},
  {type:'substitute',expected:'envoi',actual:'remboursement'},
  {type:'match',expected:'complet.',actual:'complet.'}
];
const box={complex,previous};vm.createContext(box);vm.runInContext(classifier+';r1=sebClassifyAlignmentV3(complex);r2=sebClassifyAlignmentV3(previous);',box);
if(box.r1.substitutions!==1||box.r1.omissions!==1||box.r1.additions!==0||box.r1.moved!==3)fail('cas complexe incorrect: '+JSON.stringify(box.r1));
if(box.r2.substitutions!==1||box.r2.omissions!==1||box.r2.additions!==1||box.r2.moved!==2)fail('ancien cas inversion régressé: '+JSON.stringify(box.r2));

const runtime=String.raw`
<script id="seb-dictee-complex-move-v3">
(function(){
  'use strict';
  ${classifier}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
  function render(d){
    const feedback=document.getElementById('feedback');if(!feedback||!Array.isArray(d.alignment))return;
    const parts=d.alignment.map(item=>{
      if(item.type==='match')return '<span class="word-ok">'+esc(item.actual)+'</span>';
      if(item.type==='moved')return '<span style="color:#1565c0;font-weight:700;text-decoration:underline;" title="Mot déplacé — attendu : '+esc(item.expected)+'">'+esc(item.actual)+'</span>';
      if(item.type==='substitute')return '<span class="word-wrong" title="Attendu : '+esc(item.expected)+'">'+esc(item.actual||'…')+'</span>';
      if(item.type==='insert')return '<span class="word-added" title="Mot ajouté">'+esc(item.actual)+'</span>';
      return '<span class="word-missing" title="Mot oublié">['+esc(item.expected)+']</span>';
    });
    feedback.innerHTML='<div class="feedback-title">Correction</div><div style="line-height:1.7">'+parts.join(' ')+'</div>'+ 
      '<div class="legend"><span class="word-ok">Vert : correct</span> · <span class="word-wrong">Rouge : mot incorrect</span> · <span class="word-missing">Orange : mot oublié</span> · <span style="color:#1565c0;font-weight:700;">Bleu : mot déplacé</span> · <span class="word-added">Violet : mot ajouté</span></div>'+ 
      '<div class="scoreline">Score : '+d.scoreSur20+'/20 — '+d.motsCorrects+'/'+(d.motsTotal||80)+' mots correctement alignés — '+d.substitutions+' mot(s) incorrect(s), '+d.omissions+' omission(s), '+d.ajouts+' ajout(s), '+(d.deplacements||0)+' déplacement(s).</div>'+ 
      '<div class="legend">Indicateurs non déduits séparément : '+(d.erreursPonctuation||0)+' erreur(s) de ponctuation, '+(d.erreursMajuscules||0)+' erreur(s) de majuscule.</div>';
    feedback.classList.add('visible');
  }
  function apply(){
    let d=null;try{d=JSON.parse(sessionStorage.getItem('dictee_data')||'null')}catch(_){}
    if(!d||d.status!=='verified')return;
    const base=Array.isArray(d.alignmentOriginal)?d.alignmentOriginal:(Array.isArray(d.alignment)?d.alignment:null);if(!base)return;
    const c=sebClassifyAlignmentV3(base);if(!d.alignmentOriginal)d.alignmentOriginal=base;
    d.alignment=c.items;d.substitutions=c.substitutions;d.omissions=c.omissions;d.ajouts=c.additions;d.deplacements=c.moved;d.classificationVersion=3;
    try{sessionStorage.setItem('dictee_data',JSON.stringify(d))}catch(_){}
    try{window.sebEvalPro&&window.sebEvalPro.save&&window.sebEvalPro.save()}catch(_){}
    render(d);
  }
  const verify=document.getElementById('verifyBtn');if(verify)verify.addEventListener('click',()=>setTimeout(apply,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});else setTimeout(apply,0);
})();
</script>`;
let dictee=fs.readFileSync(dicteePath,'utf8');
if(dictee.includes('seb-dictee-complex-move-v3'))fail('runtime dictée v3 déjà présent');
dictee=dictee.replace(/<\/body>/i,runtime+'\n</body>');
fs.writeFileSync(dicteePath,dictee,'utf8');

const resultRuntime=String.raw`
<script id="seb-dictee-complex-results-v3">
(function(){
  'use strict';
  ${classifier}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
  function refresh(){
    const root=document.getElementById('seb-dictee-results');if(!root)return;
    let d=null;try{d=JSON.parse(sessionStorage.getItem('dictee_data')||'null')}catch(_){}
    if(!d||d.status!=='verified')return;
    const base=Array.isArray(d.alignmentOriginal)?d.alignmentOriginal:(Array.isArray(d.alignment)?d.alignment:null);if(!base)return;
    if(d.classificationVersion!==3){const c=sebClassifyAlignmentV3(base);if(!d.alignmentOriginal)d.alignmentOriginal=base;d.alignment=c.items;d.substitutions=c.substitutions;d.omissions=c.omissions;d.ajouts=c.additions;d.deplacements=c.moved;d.classificationVersion=3;try{sessionStorage.setItem('dictee_data',JSON.stringify(d))}catch(_){}}
    if(!Array.isArray(d.alignment))return;
    const sig=[d.substitutions,d.omissions,d.ajouts,d.deplacements,d.erreursPonctuation,d.erreursMajuscules,d.ecoutes].join('|');
    if(root.dataset.sebDictV3===sig)return;root.dataset.sebDictV3=sig;
    const line=root.querySelector('p.ligne');
    if(line)line.innerHTML='<span>Mots incorrects : '+(d.substitutions||0)+'</span><span>Omissions : '+(d.omissions||0)+'</span><span>Ajouts : '+(d.ajouts||0)+'</span><span>Déplacements : '+(d.deplacements||0)+'</span><span>Ponctuation : '+(d.erreursPonctuation||0)+'</span><span>Majuscules : '+(d.erreursMajuscules||0)+'</span><span>Lectures depuis le début : '+(d.ecoutes||0)+'</span>';
    const blocks=Array.from(root.querySelectorAll('.message-block'));const correction=blocks.find(b=>String(b.textContent||'').toLowerCase().includes('correction colorée'));
    if(correction){const parts=d.alignment.map(item=>{if(item.type==='match')return '<span class="correct">'+esc(item.actual)+'</span>';if(item.type==='moved')return '<span style="color:#1565c0;font-weight:bold;text-decoration:underline;" title="Mot déplacé — attendu : '+esc(item.expected)+'">'+esc(item.actual)+'</span>';if(item.type==='substitute')return '<span class="incorrect" title="Attendu : '+esc(item.expected)+'">'+esc(item.actual||'…')+'</span>';if(item.type==='insert')return '<span style="color:#7b2cbf;font-weight:bold;text-decoration:line-through;" title="Mot ajouté">'+esc(item.actual)+'</span>';if(item.type==='delete')return '<span style="color:#d97706;font-weight:bold;" title="Mot oublié">['+esc(item.expected)+']</span>';return ''}).join(' ');correction.innerHTML='<b>Correction colorée :</b><div style="line-height:1.6;margin-top:4px;">'+parts+'</div><div class="commentaire" style="margin-top:5px;">Vert : correct · Rouge : incorrect · Orange : oublié · Bleu souligné : déplacé · Violet barré : ajouté.</div>'}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,0),{once:true});else setTimeout(refresh,0);
  new MutationObserver(()=>requestAnimationFrame(refresh)).observe(document.documentElement,{childList:true,subtree:true});
})();
</script>`;
let qcm=fs.readFileSync(qcmPath,'utf8');
if(qcm.includes('seb-dictee-complex-results-v3'))fail('runtime résultats v3 déjà présent');
qcm=qcm.replace(/<\/body>/i,resultRuntime+'\n</body>');
fs.writeFileSync(qcmPath,qcm,'utf8');

console.log('SEB EvalPro dictée v3: inversion complexe validée — groupe testé = 1 incorrect, 1 omission, 0 ajout, 3 déplacements; score inchangé.');
