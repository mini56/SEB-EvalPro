(()=>{'use strict';

const SEB_V4_ROWS=[["fabrication-plan","la lecture et la compréhension d’un plan"],["fabrication-tracage","le traçage et le repérage"],["fabrication-decoupe","la découpe"],["fabrication-assemblage","le pliage et l’assemblage"],["fabrication-finition","la qualité des finitions"],["briques-identification","la lecture et l’interprétation d’un schéma"],["briques-manipulation","la manipulation et l’assemblage de pièces"],["carre","le raisonnement visuo-spatial et la résolution d’un problème structuré"],["organisation","l’organisation et la gestion logistique"],["planning","la planification de tâches sous contraintes"],["tri-temps","le rythme de réalisation du tri"],["tri-erreurs","la fiabilité et le contrôle dans la tâche de tri"],["texte","l’utilisation du traitement de texte"],["mail","l’utilisation de la messagerie électronique"],["expression","l’expression écrite"],["math-enonce","la compréhension des consignes et énoncés mathématiques"],["math-problemes","les calculs et la résolution de problèmes mathématiques"]];
function sebV4Generate(level,text,lead){
 const out=[lead+' a participé à un ensemble de mises en situation permettant d’apprécier ses compétences techniques, organisationnelles, numériques et ses savoirs fondamentaux.'];
 const points=[],alerts=[];
 for(const [key,label] of SEB_V4_ROWS){
  const l=String(level(key)||'');
  if(l==='I'){out.push('La compétence relative à '+label+' est maîtrisée et constitue un point d’appui dans le parcours.');points.push(label)}
  else if(l==='II'){out.push('La compétence relative à '+label+' est globalement accessible. Des repères, une vérification ou des consignes complémentaires restent utiles pour sécuriser la réalisation.');alerts.push(label)}
  else if(l==='III'){out.push('La compétence relative à '+label+' reste fragile. Elle nécessite un accompagnement plus soutenu, une méthode explicite ou davantage de temps pour être mobilisée efficacement.');alerts.push(label)}
  else if(l==='NE'){out.push('La compétence relative à '+label+' n’a pas pu être évaluée au cours du parcours.')}
 }
 if(points.length)out.push('Les principaux points d’appui observés concernent '+points.slice(0,3).join(', ').replace(/, ([^,]*)$/, ' et $1')+'.');
 if(alerts.length)out.push('Les axes de consolidation prioritaires concernent '+alerts.slice(0,3).join(', ').replace(/, ([^,]*)$/, ' et $1')+'.');
 else out.push('Au regard des éléments évalués, le parcours ne fait pas apparaître de difficulté majeure nécessitant un accompagnement spécifique.');
 return out.slice(0,20).join('\n');
}
function sebV4Identity(c){
 c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();
 if(cv==='M.')return{lead:n?'M. '+n:'La personne',title:n?'M. '+n:'la personne'};
 if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',title:n?'Mme '+n:'la personne'};
 if(cv==='Autre')return{lead:n||'La personne',title:n||'la personne'};
 return{lead:'La personne',title:'la personne'};
}

const FEEL='seb_evalpro_bilan_ressenti';
function candidate(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
function r(k){return document.querySelector('tr[data-r="'+k+'"]')}
function lev(k){const x=r(k);return String(x?.dataset.level||x?.querySelector('.level.on')?.dataset.l||'')}
function txt(k){const x=r(k);return x?String(x.querySelector('.ctxt')?.value||''):''}
function feelingTitle(){return 'Ressenti de '+sebV4Identity(candidate()).title+' sur son plateau technique'}
window.sebEvalProFeelingTitle=feelingTitle;
function install(){
 const sec=document.getElementById('seb-bilan-synthese'),area=document.getElementById('seb-bilan-synthese-text');if(!sec||!area)return;
 const old=document.getElementById('seb-generate-synthese');if(old){const b=old.cloneNode(true);old.replaceWith(b);b.addEventListener('click',()=>{area.value=sebV4Generate(lev,txt,sebV4Identity(candidate()).lead);area.dispatchEvent(new Event('input',{bubbles:true}));const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Synthèse institutionnelle générée — vous pouvez la modifier.'})}
 let f=document.getElementById('seb-bilan-ressenti');if(!f){f=document.createElement('section');f.id='seb-bilan-ressenti';f.innerHTML='<h2 id="seb-bilan-ressenti-title"></h2><p>Renseigner ici le bilan personnel exprimé par le stagiaire sur son parcours au plateau technique.</p><textarea id="seb-bilan-ressenti-text"></textarea>';sec.insertAdjacentElement('afterend',f)}
 document.getElementById('seb-bilan-ressenti-title').textContent=feelingTitle();const a=document.getElementById('seb-bilan-ressenti-text');a.value=sessionStorage.getItem(FEEL)||'';a.addEventListener('input',()=>{sessionStorage.setItem(FEEL,a.value||'');window.sebEvalPro?.save?.()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
})();
