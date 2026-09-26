(()=>{'use strict';
const A='seb_evalpro_abandons',S='seb_evalpro_bilan_synthese',K='admin_bilan_state',AC='Exercice abandonné.';
const abandonMap={
'brique.html':['briques-identification','briques-manipulation'],'stock.html':['organisation'],'planning.html':['planning'],'tri_de_cheville.html':['tri-temps','tri-erreurs'],'nwtexte.html':['texte'],'nvmail.html':['mail'],'carre.html':['carre'],'qcmv1.0.html#page2':['math-enonce'],'qcmv1.0.html#page2_1':['math-enonce'],'qcmv1.0.html#page3':['math-problemes'],'qcmv1.0.html#page4':['math-problemes'],'qcmv1.0.html#page6':['math-problemes'],'qcmv1.0.html#page8':['mail']};
const shortName={'fabrication-plan':'la lecture de plan','fabrication-tracage':'le traçage','fabrication-decoupe':'la découpe','fabrication-assemblage':'l’assemblage','fabrication-finition':'les finitions','briques-identification':'la lecture du schéma','briques-manipulation':'l’assemblage des briques','carre':'la résolution de problèmes','organisation':'l’organisation du stock','planning':'la planification','tri-temps':'le rythme du tri','tri-erreurs':'la fiabilité du tri','texte':'le traitement de texte','mail':'la messagerie','expression':'l’expression écrite','math-enonce':'la compréhension des consignes mathématiques','math-problemes':'la résolution des problèmes mathématiques'};
const groups={technical:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition','briques-identification','briques-manipulation'],organization:['carre','organisation','planning'],digital:['texte','mail'],fundamentals:['expression','math-enonce','math-problemes']};
function j(k,d){try{return JSON.parse(sessionStorage.getItem(k)||'null')??d}catch{return d}}
function abandons(){const v=j(A,[]);return Array.isArray(v)?v:[]}
function abandonKey(r){return String(r?.key||String(r?.page||'')+(r?.qcmPage?'#'+r.qcmPage:''))}
function hasPage5Score(){const sc=j('scores_data',{});for(let i=1;i<=8;i++)if(Object.hasOwn(sc,'page5_q'+i))return true;return false}
function triPerformedCount(){const tri=j('tri_cheville_data',null);if(!Array.isArray(tri?.tris))return 0;return tri.tris.slice(0,5).filter(t=>{const m=+t?.minutes||0,s=+t?.secondes||0;return m||s}).length}
function targets(r){const k=abandonKey(r);if(k==='tri_de_cheville.html'&&triPerformedCount()>0)return[];if(k==='planning.html'&&hasPage5Score())return[];return abandonMap[k]||abandonMap[String(r?.page||'')]||[]}
function lev(row,l){row.querySelectorAll('.level').forEach(c=>c.classList.toggle('on',c.dataset.l===l));row.dataset.level=l}
function applyAbandons(){const set=new Set;abandons().forEach(r=>targets(r).forEach(id=>{const row=document.querySelector('tr[data-r="'+id+'"]');if(!row)return;set.add(id);lev(row,'NE');const s=row.querySelector('.csel'),t=row.querySelector('.ctxt'),d=row.querySelector('.detail');if(s){const o=[...s.options].find(x=>x.dataset.l==='NE');if(o)s.value=o.value}if(t)t.value=AC;if(d)d.textContent='';row.dataset.sebAbandoned='1'}));return set}
function persist(){let x=j(K,{rows:{}});if(!x||typeof x!=='object')x={rows:{}};if(!x.rows)x.rows={};document.querySelectorAll('tr[data-r]').forEach(r=>x.rows[r.dataset.r]={level:r.dataset.level||'',select:r.querySelector('.csel')?.value||'',comment:r.querySelector('.ctxt')?.value||'',detail:r.querySelector('.detail')?.textContent||''});const a=document.getElementById('triAvg'),e=document.getElementById('triErr'),t=document.getElementById('triTimes');if(a)x.triAvg=a.textContent;if(e)x.triErr=e.textContent;if(t)x.triTimes=t.innerHTML;sessionStorage.setItem(K,JSON.stringify(x));window.sebEvalPro?.save?.()}
function identity(){const c=j('candidat_data',{}),nom=String(c.nom||'').trim(),cv=String(c.civilite||'').trim();if(cv==='M.')return{lead:nom?'M. '+nom.toUpperCase():'La personne',next:'Il'};if(cv==='Mme')return{lead:nom?'Mme '+nom.toUpperCase():'La personne',next:'Elle'};if(cv==='Autre')return{lead:nom?nom.toUpperCase():'La personne',next:'Iel'};return{lead:'La personne',next:'La personne'}}
function levelOf(id,abandoned){if(abandoned.has(id))return'NE';const r=document.querySelector('tr[data-r="'+id+'"]');return String(r?.dataset.level||'')}
function worst(ids,abandoned){const rank={I:1,II:2,III:3},vals=ids.map(id=>[id,levelOf(id,abandoned)]).filter(([,l])=>rank[l]);if(!vals.length)return{level:'',id:'',vals:[]};vals.sort((a,b)=>rank[b[1]]-rank[a[1]]);return{level:vals[0][1],id:vals[0][0],vals}}
function allI(ids,abandoned){const v=ids.map(id=>levelOf(id,abandoned)).filter(l=>['I','II','III'].includes(l));return v.length&&v.every(l=>l==='I')}
function nextSubject(state,id){const s=state.used?id.next:id.lead;state.used=true;return s}
function sentenceTechnical(out,state,id,abandoned){const w=worst(groups.technical,abandoned);if(!w.level)return;if(allI(groups.technical,abandoned)){out.push(nextSubject(state,id)+' réalise les activités techniques avec autonomie.');return}if(w.level==='III'){out.push(nextSubject(state,id)+' rencontre des difficultés dans les activités techniques.');out.push('Le point le plus fragile concerne '+shortName[w.id]+'.');return}out.push(nextSubject(state,id)+' réalise les activités techniques de façon globalement satisfaisante.');out.push('Des consignes complémentaires restent utiles pour '+shortName[w.id]+'.')}
function sentenceOrganization(out,state,id,abandoned){const w=worst(groups.organization,abandoned);if(!w.level)return;if(allI(groups.organization,abandoned)){out.push(nextSubject(state,id)+' s’organise correctement dans les exercices de logique et de planification.');return}if(w.level==='III'){out.push('Les exercices d’organisation et de planification restent difficiles.');return}out.push('L’organisation est globalement comprise.');out.push('Quelques erreurs apparaissent dans les tâches sous contraintes.')}
function sentenceTri(out,abandoned){const t=levelOf('tri-temps',abandoned),e=levelOf('tri-erreurs',abandoned);if(!['I','II','III'].includes(t)&&!['I','II','III'].includes(e))return;if(t==='I'&&e==='I'){out.push('Le tri de chevilles est réalisé avec un rythme et une fiabilité satisfaisants.');return}if(t==='I'){out.push('Le rythme du tri est satisfaisant.');if(e==='II')out.push('La fiabilité demande encore de l’attention.');else if(e==='III')out.push('Le nombre d’erreurs reste important.');return}if(e==='I'){out.push('Le tri est fiable.');out.push(t==='II'?'Le rythme de réalisation reste intermédiaire.':'Le rythme de réalisation est lent.');return}if(t==='III')out.push('Le rythme de réalisation du tri est lent.');if(e==='II')out.push('La fiabilité reste à surveiller.');if(e==='III')out.push('Le nombre d’erreurs est élevé.')}
function sentenceDigital(out,state,id,abandoned){const txt=levelOf('texte',abandoned),mail=levelOf('mail',abandoned),w=worst(groups.digital,abandoned);if(!w.level)return;if(txt==='I'&&mail==='I'){out.push(nextSubject(state,id)+' utilise le traitement de texte et la messagerie avec autonomie.');return}if(w.level==='III'){out.push('L’utilisation des outils numériques reste fragile.');out.push('La principale difficulté concerne '+shortName[w.id]+'.');return}out.push('Les outils numériques sont globalement accessibles.');out.push((w.id==='texte'?'Le traitement de texte':'La messagerie')+' demande encore un appui.')}
function mathLevel(abandoned){const a=levelOf('math-enonce',abandoned),b=levelOf('math-problemes',abandoned),rank={I:1,II:2,III:3};return rank[a]>=rank[b]?a:b}
function sentenceFundamentals(out,abandoned){const exp=levelOf('expression',abandoned),math=mathLevel(abandoned);if(!['I','II','III'].includes(exp)&&!['I','II','III'].includes(math))return;if(exp==='I'&&math==='I'){out.push('Les savoirs fondamentaux sont satisfaisants.');return}if(exp==='I'&&['II','III'].includes(math)){out.push('L’expression écrite est satisfaisante.');out.push(math==='II'?'Les mathématiques demandent davantage de rigueur.':'Les mathématiques restent difficiles.');return}if(math==='I'&&['II','III'].includes(exp)){out.push('Les mathématiques sont satisfaisantes.');out.push(exp==='II'?'L’expression écrite reste plus fragile.':'Des difficultés importantes apparaissent en expression écrite.');return}out.push('Les savoirs fondamentaux restent fragiles.');if(exp==='III'&&math!=='III')out.push('La difficulté principale concerne l’expression écrite.');else if(math==='III'&&exp!=='III')out.push('La difficulté principale concerne les mathématiques.')}
function reasonSentences(r){const q=Array.isArray(r?.raisons)?r.raisons:[],out=[];if(q.includes('Je ne comprends pas la consigne'))out.push('Le motif signalé concerne la compréhension de la consigne.');if(q.includes('L’exercice est trop difficile'))out.push('Le niveau de difficulté de l’exercice a été signalé comme trop important.');if(q.includes('Fatigue, gêne ou douleur'))out.push('Une fatigue, une gêne ou une douleur a été signalée.');const free=String(r?.commentaire||'').replace(/\s+/g,' ').trim();if(q.includes('Autre raison')&&free)out.push('Motif précisé par le candidat : '+free+(/[.!?]$/.test(free)?'':'.'));else if(free)out.push('Précision indiquée : '+free+(/[.!?]$/.test(free)?'':'.'));if(!out.length)out.push('Le motif de l’abandon n’a pas été renseigné.');return out}
function abandonLabel(r){return String(r?.exercice||r?.page||'Exercice').replace(/^Exercice\s+/i,'').trim()||'Exercice'}
function sentenceAbandons(out){abandons().forEach(r=>{out.push('L’exercice « '+abandonLabel(r)+' » a été abandonné.');reasonSentences(r).forEach(x=>out.push(x))})}
function sentenceNE(out,abandoned){const ids=[...document.querySelectorAll('tr[data-r]')].map(r=>r.dataset.r),n=ids.filter(id=>levelOf(id,abandoned)==='NE'&&!abandoned.has(id)).length;if(n>=3)out.push('Plusieurs éléments du bilan n’ont pas pu être évalués.')}
function paragraphs(sentences){const cleaned=sentences.map(s=>String(s||'').replace(/\s+/g,' ').trim()).filter(Boolean);const blocks=[];for(let i=0;i<cleaned.length;i+=3)blocks.push(cleaned.slice(i,i+3).join(' '));return blocks.join('\n\n')}
function generate(){const abandoned=applyAbandons(),out=[],state={used:false},id=identity();sentenceTechnical(out,state,id,abandoned);sentenceOrganization(out,state,id,abandoned);sentenceTri(out,abandoned);sentenceDigital(out,state,id,abandoned);sentenceFundamentals(out,abandoned);sentenceAbandons(out);sentenceNE(out,abandoned);return out.length?paragraphs(out):'La synthèse pourra être générée lorsque le bilan comportera des éléments évalués.'}
function reference(){const el=document.getElementById('seb-abandon-reference');if(!el)return;const a=abandons();if(!a.length){el.hidden=true;el.textContent='';return}el.hidden=false;el.textContent='Motifs d’abandon saisis par le stagiaire — référence administrateur uniquement\n'+a.map(r=>'• '+abandonLabel(r)+' — '+(Array.isArray(r.raisons)&&r.raisons.length?r.raisons.join(' ; '):'motif non renseigné')+(String(r.commentaire||'').trim()?' — précision libre : '+String(r.commentaire).trim():'')).join('\n')}
function saveSummary(){const a=document.getElementById('seb-bilan-synthese-text');if(a){sessionStorage.setItem(S,a.value||'');window.sebEvalPro?.save?.()}}
function install(){const table=document.getElementById('bilan');if(!table||document.getElementById('seb-bilan-synthese'))return;const sec=document.createElement('section');sec.id='seb-bilan-synthese';sec.innerHTML='<h2>Synthèse du bilan</h2><p class="help">Proposition automatique locale. Elle retient les constats principaux et reste entièrement modifiable par l’administrateur.</p><div class="actions"><button type="button" id="seb-generate-synthese">Générer / régénérer la synthèse</button><span id="seb-synthese-status"></span></div><textarea id="seb-bilan-synthese-text"></textarea><div id="seb-abandon-reference" hidden></div>';table.insertAdjacentElement('afterend',sec);const area=document.getElementById('seb-bilan-synthese-text'),savedSummary=sessionStorage.getItem(S)||'',initialStatus=document.getElementById('seb-synthese-status');area.value=savedSummary;if(initialStatus)initialStatus.textContent=String(savedSummary).trim()?'Synthèse enregistrée précédemment — cliquez sur Générer pour la régénérer.':'Synthèse non générée.';area.addEventListener('input',saveSummary);document.getElementById('seb-generate-synthese').addEventListener('click',()=>{area.value=generate();saveSummary();persist();document.getElementById('seb-synthese-status').textContent='Synthèse générée — vous pouvez la modifier.';reference()});document.getElementById('auto')?.addEventListener('click',()=>setTimeout(()=>{applyAbandons();persist();reference()},0));document.getElementById('save')?.addEventListener('click',()=>{saveSummary();applyAbandons();persist()});applyAbandons();persist();reference()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* ---- migrated final runtime block ---- */

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

/* ---- migrated final runtime block ---- */

(()=>{'use strict';

const SEB_NAT_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 fondamentaux:['expression','math-enonce','math-problemes']
};
function sebNatIdentity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebNatJoin(a){a=a.filter(Boolean);return a.length<2?(a[0]||''):a.length===2?a[0]+' et '+a[1]:a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebNatCap(s){s=String(s||'');return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebNatDomainScore(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebNaturalSummary(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||'').replace(/\s+/g,' ').trim(),p=[];const all=Object.values(SEB_NAT_GROUPS).flat(),ev=all.filter(k=>['I','II','III'].includes(L(k))).length,ne=all.filter(k=>L(k)==='NE').length,good=all.filter(k=>L(k)==='I').length,hard=all.filter(k=>L(k)==='III').length;
 let intro=id.lead+' a participé aux différentes mises en situation proposées au cours du plateau technique. ';
 if(ev&&good>=Math.ceil(ev*0.65)&&hard<=2)intro+='L’ensemble fait apparaître plusieurs acquis solides et une autonomie globalement satisfaisante, avec quelques points qui restent à consolider.';
 else if(ev)intro+='Les résultats font apparaître un profil contrasté, avec des points d’appui identifiés et des situations qui nécessitent encore des repères ou un accompagnement.';
 else intro+='Le bilan comporte encore trop peu d’éléments évalués pour dégager une tendance générale.';
 if(ne>=3)intro+=' Certaines activités n’ayant pas pu être évaluées, les conclusions doivent être replacées dans le cadre des situations effectivement réalisées.';p.push(intro);
 const fabGood=[],fabMid=[],fabHard=[],fabNE=[];const fabLabels={'fabrication-plan':'la lecture du plan','fabrication-tracage':'le traçage','fabrication-decoupe':'la découpe','fabrication-assemblage':'l’assemblage','fabrication-finition':'les finitions'};
 for(const k of SEB_NAT_GROUPS.fabrication){const l=L(k);if(l==='I')fabGood.push(fabLabels[k]);else if(l==='II')fabMid.push(fabLabels[k]);else if(l==='III')fabHard.push(fabLabels[k]);else if(l==='NE')fabNE.push(fabLabels[k])}
 if(fabGood.length||fabMid.length||fabHard.length||fabNE.length){let s='Dans les activités de fabrication, ';if(fabGood.length>=3)s+='les bases techniques sont bien installées. '+sebNatCap(sebNatJoin(fabGood.slice(0,3)))+' constituent des points d’appui dans la réalisation. ';else if(fabGood.length)s+=sebNatCap(sebNatJoin(fabGood))+' fait partie des éléments maîtrisés. ';if(fabMid.length)s+=sebNatCap(sebNatJoin(fabMid))+(fabMid.length>1?' demandent':' demande')+' encore davantage de contrôle et de précision. ';if(fabHard.length)s+=sebNatCap(sebNatJoin(fabHard))+(fabHard.length>1?' mettent':' met')+' en évidence un besoin d’accompagnement plus important ou d’une méthode plus structurée. ';if(fabNE.length)s+='L’évaluation n’a pas pu porter sur '+sebNatJoin(fabNE)+'.';p.push(s.trim())}
 const bi=L('briques-identification'),bm=L('briques-manipulation');if(['I','II','III','NE'].includes(bi)||['I','II','III','NE'].includes(bm)){let s='La construction à base de briques ';if(bi==='I'&&bm==='I')s+='confirme de bonnes capacités visuo-constructives. '+id.subject+' comprend le schéma proposé, identifie les éléments utiles et réalise l’assemblage de manière satisfaisante. Cette activité montre que les consignes structurées et les supports visuels peuvent être mobilisés efficacement.';else{const bGood=[],bNeed=[];if(bi==='I')bGood.push('la lecture du schéma');else if(bi==='II'||bi==='III')bNeed.push('l’interprétation du schéma');if(bm==='I')bGood.push('la manipulation et l’assemblage');else if(bm==='II'||bm==='III')bNeed.push('la manipulation et l’assemblage');s+='met en évidence des résultats plus nuancés. ';if(bGood.length)s+=sebNatJoin(bGood)+' constitue'+(bGood.length>1?'nt':'')+' un point d’appui. ';if(bNeed.length)s+=sebNatJoin(bNeed)+' demande'+(bNeed.length>1?'nt':'')+' encore des repères, de la vérification ou davantage de temps.';if(bi==='NE'||bm==='NE')s+=' Une partie de cette compétence n’a pas pu être appréciée.'}p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices sollicitant le raisonnement, l’organisation et la planification ';if(ca==='I'&&og==='I'&&pl==='I')s+='sont réalisés de manière satisfaisante. '+id.subject+' parvient à analyser la situation, organiser les informations et ordonner les étapes attendues avec une autonomie adaptée.';else{s+='font apparaître des résultats contrastés. ';if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite pour construire une stratégie efficace. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être structurée et vérifiée. ';else if(ca==='I')s+='Le raisonnement sur une situation structurée constitue un point d’appui. ';if(og==='III')s+='L’organisation d’une tâche comportant plusieurs critères reste également fragile. ';else if(og==='II')s+='L’organisation multicritère est comprise, mais demande encore des vérifications. ';else if(og==='I')s+='La gestion d’une tâche comportant plusieurs critères est correctement appréhendée. ';if(pl==='I'&&(og==='II'||og==='III'||ca==='II'||ca==='III'))s+='À l’inverse, la planification est correctement réalisée : '+id.subject.toLowerCase()+' sait ordonner des étapes lorsque le cadre et les contraintes sont clairement identifiés.';else if(pl==='II')s+='La planification est globalement comprise, avec encore quelques erreurs dans la prise en compte des contraintes.';else if(pl==='III')s+='La planification nécessite un accompagnement pour hiérarchiser les actions et maintenir un ordre d’exécution cohérent.'}p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée de façon régulière avec un contrôle adapté du travail effectué.';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent que le niveau attendu. La précision constitue donc un point d’appui, tandis que la vitesse d’exécution reste à renforcer.';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de limiter les erreurs.';else s+='le rythme et la fiabilité restent à consolider. Cette tâche répétitive demande encore de trouver un meilleur équilibre entre vitesse d’exécution et contrôle.';p.push(s)}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I'&&ma==='I')s+='les compétences de base sont acquises. '+id.subject+' utilise le traitement de texte et la messagerie électronique avec une autonomie satisfaisante dans les situations proposées.';else if(tx==='III'&&(ma==='I'||ma==='II'))s+='le traitement de texte constitue le principal point de difficulté. Son utilisation nécessite encore un accompagnement pour mobiliser les fonctions demandées de façon autonome. La messagerie électronique est mieux appréhendée'+(ma==='II'?', même si certains repères restent à consolider.':'.');else if(ma==='III'&&(tx==='I'||tx==='II'))s+='le traitement de texte est globalement accessible, alors que l’utilisation de la messagerie électronique reste plus difficile. Un accompagnement est nécessaire pour sécuriser les différentes étapes d’un envoi et l’utilisation des fonctions associées.';else{s+='les acquis sont partiels. ';if(tx==='II')s+='Le traitement de texte est utilisable dans les tâches simples, mais certaines fonctions demandent encore des repères. ';if(ma==='II')s+='La messagerie électronique est également accessible, avec un besoin de vérification pour les opérations moins familières. ';if(tx==='I')s+='Le traitement de texte constitue un point d’appui. ';if(ma==='I')s+='La messagerie électronique est maîtrisée. ';if(tx==='NE'||ma==='NE')s+='Une partie des usages numériques n’a pas pu être évaluée.'}p.push(s.trim())}
 const ex=L('expression'),me=L('math-enonce'),mp=L('math-problemes');if([ex,me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='Sur les savoirs fondamentaux, ';if(ex==='I')s+='l’expression écrite est maîtrisée dans les situations évaluées. ';else if(ex==='II')s+='les acquis en expression écrite sont présents mais demandent encore à être consolidés pour gagner en clarté, en précision et en régularité. ';else if(ex==='III')s+='l’expression écrite reste fragile et nécessite un accompagnement pour structurer les idées et sécuriser les règles de base. ';else if(ex==='NE')s+='l’expression écrite n’a pas pu être évaluée. ';if(me==='I')s+='En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='La compréhension des consignes mathématiques est globalement accessible, mais certaines informations doivent encore être reformulées ou vérifiées. ';else if(me==='III')s+='La compréhension des consignes mathématiques reste difficile et peut freiner l’entrée dans la résolution. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont ensuite réalisés de manière satisfaisante.';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions dans l’application des procédures.';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessitent un accompagnement plus soutenu.';else if(mp==='NE')s+='La partie portant sur les calculs et la résolution de problèmes n’ayant pas pu être évaluée, il n’est pas possible de conclure sur ce volet.';p.push(s.trim())}
 const domains=[['les activités techniques',sebNatDomainScore(level,SEB_NAT_GROUPS.fabrication.concat(SEB_NAT_GROUPS.briques))],['l’organisation et le raisonnement',sebNatDomainScore(level,SEB_NAT_GROUPS.organisation)],['les tâches répétitives',sebNatDomainScore(level,SEB_NAT_GROUPS.tri)],['les outils numériques',sebNatDomainScore(level,SEB_NAT_GROUPS.numerique)],['les savoirs fondamentaux',sebNatDomainScore(level,SEB_NAT_GROUPS.fondamentaux)]].filter(x=>x[1]>0);domains.sort((a,b)=>b[1]-a[1]);const strengths=domains.filter(x=>x[1]>=2.55).slice(0,2).map(x=>x[0]),needs=domains.filter(x=>x[1]<2.25).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]);let c='Dans l’ensemble, ';if(strengths.length)c+='les appuis les plus nets se situent dans '+sebNatJoin(strengths)+'. ';else c+='le parcours met en évidence des acquis mobilisables, mais encore inégaux selon les situations. ';if(needs.length)c+='Les principaux axes de progression concernent '+sebNatJoin(needs)+'. ';else c+='Aucune fragilité majeure ne se dégage des domaines effectivement évalués. ';c+='Ces éléments sont à mettre en perspective avec le ressenti exprimé par la personne et avec les exigences du projet professionnel envisagé.';p.push(c);
 return p.filter(Boolean).join('\n\n');
}

function c5(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
function r5(k){return document.querySelector('tr[data-r="'+k+'"]')}
function l5(k){const r=r5(k);return String(r?.dataset.level||r?.querySelector('.level.on')?.dataset.l||'')}
function t5(k){const r=r5(k);if(!r)return'';return [r.querySelector('.ctxt')?.value,r.querySelector('.detail')?.textContent,r.querySelector('.csel')?.value].map(x=>String(x||'').trim()).filter(Boolean).join(' ')}
function install5(){const area=document.getElementById('seb-bilan-synthese-text'),old=document.getElementById('seb-generate-synthese');if(!area||!old)return;const b=old.cloneNode(true);b.id='seb-generate-synthese';b.dataset.naturalV5='1';old.replaceWith(b);b.addEventListener('click',()=>{area.value=sebNaturalSummary(l5,t5,sebNatIdentity(c5()));area.dispatchEvent(new Event('input',{bubbles:true}));const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Synthèse rédigée par grands domaines — vous pouvez la modifier.'});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install5,40),{once:true});else setTimeout(install5,40);})();

/* ---- migrated final runtime block ---- */

(()=>{'use strict';

const SEB_V6_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 expression:['expression'],
 maths:['math-enonce','math-problemes']
};
const SEB_V6_LABELS={
 'fabrication-plan':'la lecture et la compréhension du plan',
 'fabrication-tracage':'le traçage et le repérage',
 'fabrication-decoupe':'la découpe',
 'fabrication-assemblage':'le pliage et l’assemblage',
 'fabrication-finition':'les finitions',
 'briques-identification':'la lecture du schéma',
 'briques-manipulation':'la manipulation et l’assemblage des briques',
 'carre':'le raisonnement visuo-spatial',
 'organisation':'l’organisation et la gestion logistique',
 'planning':'la planification',
 'tri-temps':'le rythme de réalisation du tri',
 'tri-erreurs':'la fiabilité du tri',
 'texte':'le traitement de texte',
 'mail':'la messagerie électronique',
 'expression':'l’expression écrite',
 'math-enonce':'la compréhension des consignes mathématiques',
 'math-problemes':'les calculs et la résolution de problèmes'
};
function sebV6Identity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebV6Join(a){a=a.filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return a[0]+' et '+a[1];return a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebV6Lower(s){s=String(s||'').trim();return s?s.charAt(0).toLowerCase()+s.slice(1):s}
function sebV6CleanComment(v){let s=String(v||'').replace(/\s+/g,' ').trim();s=s.replace(/^(?:NE|I{1,3}|IV)\s*[.\-:;]\s*/i,'');s=s.replace(/\s+([,.;:!?])/g,'$1');if(/^(?:exercice abandonné|non évalué|non evalue|choisissez|aucun commentaire)\.?$/i.test(s))return'';return s.replace(/[.;]\s*$/,'').trim()}
function sebV6AdaptComment(v,id){let s=sebV6CleanComment(v);if(!s)return'';if(id&&id.subject&&id.subject!=='La personne')s=s.replace(/^La personne\b/i,id.subject);return s}
function sebV6Dedupe(v){let s=String(v||'').trim();if(!s)return'';const ps=s.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);for(let n=1;n<=Math.floor(ps.length/2);n++){if(ps.length%n)continue;let ok=true;for(let i=n;i<ps.length;i++){if(ps[i]!==ps[i%n]){ok=false;break}}if(ok)return ps.slice(0,n).join('\n\n')}const first=(ps[0]||'').slice(0,Math.min(90,(ps[0]||'').length));if(first.length>35){const i=s.indexOf(first,first.length);if(i>180){const unit=s.slice(0,i).trim();let rest=s,count=0;while(rest.startsWith(unit)){rest=rest.slice(unit.length).trimStart();count++}if(count>1&&!rest)return unit}}return s}
function sebV6Score(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebV6Split(level,keys){const r={I:[],II:[],III:[],NE:[]};for(const k of keys){const l=String(level(k)||'');if(r[l])r[l].push(SEB_V6_LABELS[k])}return r}
function sebV6Evidence(keys,level,text,id,limit){const rank={III:0,II:1,I:2,NE:3};const seen=new Set;const rows=[];for(const k of keys){const c=sebV6AdaptComment(text(k),id);if(!c||c.length<12)continue;const z=c.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g,' ').trim();if(seen.has(z))continue;seen.add(z);rows.push({k,l:String(level(k)||''),c})}rows.sort((a,b)=>(rank[a.l]??9)-(rank[b.l]??9));return rows.slice(0,limit||2).map((x,i)=>(i?'Il est également relevé que ':'Dans le détail, ')+sebV6Lower(x.c)+'.')}
function sebV6Generate(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||''),all=Object.values(SEB_V6_GROUPS).flat(),evaluated=all.filter(k=>['I','II','III'].includes(L(k))),nI=evaluated.filter(k=>L(k)==='I').length,nII=evaluated.filter(k=>L(k)==='II').length,nIII=evaluated.filter(k=>L(k)==='III').length,nNE=all.filter(k=>L(k)==='NE').length,p=[];
 let intro=id.lead+' a participé aux différentes mises en situation du plateau technique. ';if(!evaluated.length)intro+='Les éléments actuellement renseignés ne permettent pas encore de dégager une lecture globale du parcours.';else if(nIII===0&&nII<=Math.max(2,Math.floor(evaluated.length/3)))intro+='Les observations recueillies font ressortir des acquis globalement solides, avec quelques points qui demandent encore à être consolidés.';else if(nIII<=2)intro+='Le parcours met en évidence plusieurs points d’appui, associés à des besoins de repérage ou d’accompagnement plus marqués dans certaines situations.';else intro+='Le parcours fait apparaître des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés plus importantes qui limitent encore l’autonomie sur certaines tâches.';p.push(intro);
 const f=sebV6Split(level,SEB_V6_GROUPS.fabrication);if(f.I.length||f.II.length||f.III.length||f.NE.length){let s='Dans les activités de fabrication, ';if(f.I.length>=3)s+='les bases techniques sont bien installées. '+sebV6Join(f.I.slice(0,4))+' constituent des points d’appui dans la réalisation. ';else if(f.I.length)s+=sebV6Join(f.I)+' '+(f.I.length>1?'sont maîtrisées':'est maîtrisée')+'. ';if(f.II.length)s+=sebV6Join(f.II)+' '+(f.II.length>1?'demandent':'demande')+' encore davantage de contrôle, de précision ou de vérification. ';if(f.III.length)s+=sebV6Join(f.III)+' '+(f.III.length>1?'restent difficiles et nécessitent':'reste difficile et nécessite')+' un accompagnement plus soutenu ou une méthode plus structurée. ';if(f.NE.length)s+='L’évaluation n’a pas permis de conclure sur '+sebV6Join(f.NE)+'.';const e=sebV6Evidence(SEB_V6_GROUPS.fabrication,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const b=sebV6Split(level,SEB_V6_GROUPS.briques);if(b.I.length||b.II.length||b.III.length||b.NE.length){let s='La construction à base de briques apporte un autre éclairage sur les capacités visuo-constructives. ';if(b.I.length===2)s+=id.subject+' comprend le schéma proposé et réalise l’assemblage avec une autonomie satisfaisante. ';else{if(b.I.length)s+=sebV6Join(b.I)+' constitue'+(b.I.length>1?'nt':'')+' un point d’appui. ';if(b.II.length)s+=sebV6Join(b.II)+' demande'+(b.II.length>1?'nt':'')+' encore quelques repères ou vérifications. ';if(b.III.length)s+=sebV6Join(b.III)+' nécessite'+(b.III.length>1?'nt':'')+' un accompagnement plus important. ';if(b.NE.length)s+='Une partie de cette activité n’a pas pu être appréciée.'}const e=sebV6Evidence(SEB_V6_GROUPS.briques,level,text,id,1);if(e.length)s+=' '+e[0];p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices de raisonnement, d’organisation et de planification montrent comment '+(id.subject==='La personne'?'la personne':id.subject.toLowerCase())+' aborde une situation comportant plusieurs informations ou contraintes. ';if(ca==='I')s+='Le raisonnement sur une situation structurée est correctement mobilisé. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être organisée et vérifiée. ';else if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite. ';if(og==='I')s+='L’organisation d’une tâche comportant plusieurs critères est correctement appréhendée. ';else if(og==='II')s+='L’organisation multicritère est comprise, avec encore un besoin de vérification. ';else if(og==='III')s+='L’organisation d’informations multiples constitue un point de fragilité plus marqué. ';if(pl==='I')s+='La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés.';else if(pl==='II')s+='La planification est globalement comprise, malgré quelques erreurs dans la prise en compte des contraintes.';else if(pl==='III')s+='La planification nécessite encore un accompagnement pour hiérarchiser les actions et maintenir un ordre cohérent.';const e=sebV6Evidence(SEB_V6_GROUPS.organisation,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée avec régularité et le contrôle du travail reste adapté. ';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent. La précision constitue un point d’appui alors que la vitesse d’exécution reste à renforcer. ';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de réduire les erreurs. ';else s+='le rythme et la fiabilité restent à consolider afin de trouver un meilleur équilibre entre vitesse d’exécution et contrôle. ';const e=sebV6Evidence(SEB_V6_GROUPS.tri,level,text,id,1);if(e.length)s+=e[0];p.push(s.trim())}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I')s+='le traitement de texte est utilisé avec une autonomie satisfaisante. ';else if(tx==='II')s+='le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères. ';else if(tx==='III')s+='le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées. ';else if(tx==='NE')s+='le traitement de texte n’a pas pu être évalué. ';if(ma==='I')s+='La messagerie électronique est maîtrisée dans les situations proposées.';else if(ma==='II')s+='La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.';else if(ma==='III')s+='La messagerie électronique reste difficile à utiliser de manière autonome.';else if(ma==='NE')s+='La messagerie électronique n’a pas pu être évaluée.';const e=sebV6Evidence(SEB_V6_GROUPS.numerique,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const ex=L('expression');if(['I','II','III','NE'].includes(ex)){let s='En expression écrite, ';if(ex==='I')s+='les compétences mobilisées dans les exercices proposés sont satisfaisantes.';else if(ex==='II')s+='les acquis sont présents, mais demandent encore à être consolidés pour gagner en clarté, en précision et en régularité.';else if(ex==='III')s+='des difficultés persistent dans la structuration des idées ou la maîtrise des règles de base, ce qui justifie un accompagnement plus soutenu.';else s+='les éléments disponibles ne permettent pas de conclure.';const e=sebV6Evidence(SEB_V6_GROUPS.expression,level,text,id,1);if(e.length)s+=' '+e[0];p.push(s.trim())}
 const me=L('math-enonce'),mp=L('math-problemes');if([me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='En mathématiques, ';if(me==='I')s+='la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='la compréhension des consignes est globalement accessible, même si certaines informations doivent être reformulées ou vérifiées. ';else if(me==='III')s+='la compréhension des consignes reste difficile et peut freiner l’entrée dans la résolution. ';else if(me==='NE')s+='la compréhension des consignes n’a pas pu être appréciée. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont ensuite réalisés de manière satisfaisante.';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions dans l’application des procédures.';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessite un accompagnement plus soutenu.';else if(mp==='NE')s+='La partie portant sur les calculs et la résolution de problèmes n’ayant pas été évaluée, aucune conclusion n’est retenue sur ce volet.';const e=sebV6Evidence(SEB_V6_GROUPS.maths,level,text,id,2);if(e.length)s+=' '+e.join(' ');p.push(s.trim())}
 const abandoned=all.filter(k=>L(k)==='NE'&&/exercice abandonné/i.test(T(k))).length;if(abandoned)p.push((abandoned===1?'Une activité a été interrompue au cours du parcours. ':'Plusieurs activités ont été interrompues au cours du parcours. ')+'Les compétences correspondantes restent volontairement hors interprétation dans cette synthèse.');else if(nNE>=3)p.push('Plusieurs éléments sont restés non évalués. Ils ne sont pas interprétés et limitent la portée des conclusions dans les domaines concernés.');
 const ds=[['les activités techniques et de manipulation',sebV6Score(level,SEB_V6_GROUPS.fabrication.concat(SEB_V6_GROUPS.briques))],['l’organisation, le raisonnement et la planification',sebV6Score(level,SEB_V6_GROUPS.organisation)],['le rythme et le contrôle dans le tri',sebV6Score(level,SEB_V6_GROUPS.tri)],['l’utilisation des outils numériques',sebV6Score(level,SEB_V6_GROUPS.numerique)],['l’expression écrite',sebV6Score(level,SEB_V6_GROUPS.expression)],['les compétences mathématiques',sebV6Score(level,SEB_V6_GROUPS.maths)]].filter(x=>x[1]>0);const strengths=ds.filter(x=>x[1]>=2.6).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]),needs=ds.filter(x=>x[1]<=2.15).sort((a,b)=>a[1]-b[1]).slice(0,3).map(x=>x[0]);let conclusion='Dans l’ensemble, ';if(strengths.length)conclusion+='les points d’appui les plus nets concernent '+sebV6Join(strengths)+'. ';else conclusion+='les acquis apparaissent encore variables selon les situations proposées. ';if(needs.length)conclusion+='Les principaux axes de progression concernent '+sebV6Join(needs)+'. ';else conclusion+='Les domaines évalués ne font pas apparaître de fragilité majeure nécessitant un accompagnement renforcé. ';conclusion+='Le ressenti du stagiaire, présenté séparément, complète cette lecture des observations réalisées pendant le plateau technique.';p.push(conclusion);
 return sebV6Dedupe(p.filter(Boolean).join('\n\n'));
}

function c6(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
function r6(k){return document.querySelector('tr[data-r="'+k+'"]')}
function l6(k){const r=r6(k);return String(r?.dataset.level||r?.querySelector('.level.on')?.dataset.l||'')}
function t6(k){const r=r6(k);if(!r)return'';return [r.querySelector('.ctxt')?.value,r.querySelector('.detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')}
function install6(){const area=document.getElementById('seb-bilan-synthese-text'),old=document.getElementById('seb-generate-synthese');if(!area||!old)return;const cleaned=sebV6Dedupe(area.value);if(cleaned!==String(area.value||'').trim()){area.value=cleaned;sessionStorage.setItem('seb_evalpro_bilan_synthese',cleaned);area.dispatchEvent(new Event('input',{bubbles:true}))}const b=old.cloneNode(true);b.id='seb-generate-synthese';b.dataset.naturalV6='1';old.replaceWith(b);b.addEventListener('click',()=>{const value=sebV6Generate(l6,t6,sebV6Identity(c6()));area.value=value;sessionStorage.setItem('seb_evalpro_bilan_synthese',value);area.dispatchEvent(new Event('input',{bubbles:true}));const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Synthèse renforcée à partir des niveaux et des commentaires — vous pouvez la modifier.'})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install6,100),{once:true});else setTimeout(install6,100);
})();

/* ---- migrated final runtime block ---- */

(()=>{'use strict';

const SEB_V7_GROUPS={
 fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],
 briques:['briques-identification','briques-manipulation'],
 organisation:['carre','organisation','planning'],
 tri:['tri-temps','tri-erreurs'],
 numerique:['texte','mail'],
 expression:['expression'],
 maths:['math-enonce','math-problemes']
};
const SEB_V7_LABELS={
 'fabrication-plan':'la lecture et la compréhension du plan',
 'fabrication-tracage':'le traçage et le repérage',
 'fabrication-decoupe':'la découpe',
 'fabrication-assemblage':'le pliage et l’assemblage',
 'fabrication-finition':'les finitions',
 'briques-identification':'la lecture du schéma',
 'briques-manipulation':'la manipulation et l’assemblage',
 'carre':'le raisonnement',
 'organisation':'l’organisation de plusieurs informations',
 'planning':'la planification',
 'tri-temps':'le rythme du tri',
 'tri-erreurs':'la fiabilité du tri',
 'texte':'le traitement de texte',
 'mail':'la messagerie électronique',
 'expression':'l’expression écrite',
 'math-enonce':'la compréhension des consignes mathématiques',
 'math-problemes':'les calculs et la résolution de problèmes'
};
function sebV7Identity(c){c=c||{};const cv=String(c.civilite||''),n=String(c.nom||'').trim().toUpperCase();if(cv==='M.')return{lead:n?'M. '+n:'La personne',subject:'Il'};if(cv==='Mme')return{lead:n?'Mme '+n:'La personne',subject:'Elle'};if(cv==='Autre')return{lead:n||'La personne',subject:'Iel'};return{lead:'La personne',subject:'La personne'}}
function sebV7Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV7Lower(s){s=String(s||'').trim();return s?s.charAt(0).toLowerCase()+s.slice(1):s}
function sebV7Join(a){a=a.filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return a[0]+' et '+a[1];return a.slice(0,-1).join(', ')+' et '+a[a.length-1]}
function sebV7Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV7Raw(v){return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function sebV7Clean(v){let s=sebV7Raw(v);s=s.replace(/^(?:NE|I{1,3}|IV)\s*[.\-:;]\s*/i,'');s=s.replace(/\s+([,.;:!?])/g,'$1');s=s.replace(/\s*[-—]\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:point\(s\)|points?|réponses? correctes?)?(?:\s*\([^)]*\))?.*$/i,'');s=s.replace(/\s*[-—]\s*\d+\s*erreur\(s\).*$/i,'');s=s.replace(/[.;]\s*$/,'').trim();if(/^(?:exercice abandonné|non évalué|non evalue|choisissez|aucun commentaire)$/i.test(s))return'';return s}
function sebV7Metric(raw,label){const src=sebV7Raw(raw),needle=String(label||''),i=src.toLocaleLowerCase('fr-FR').indexOf(needle.toLocaleLowerCase('fr-FR'));if(i<0)return null;const m=src.slice(i+needle.length).match(/^\s*:\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);if(!m)return null;const a=parseFloat(m[1].replace(',','.')),b=parseFloat(m[2].replace(',','.'));return Number.isFinite(a)&&Number.isFinite(b)&&b>0?a/b:null}
function sebV7Result(raw,label){
 const src=sebV7Raw(raw);if(!src||/exercice abandonné|non évalué|non evalue/i.test(src))return'';
 const pct=src.match(/(\d+(?:[.,]\d+)?)\s*%/);
 const score=src.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:point\(s\)|points?|réponses? correctes?)?/i);
 const fmt=v=>String(v).replace('.',',');
 if(score){
  const a=parseFloat(score[1].replace(',','.')),b=parseFloat(score[2].replace(',','.'));
  const p=pct?pct[1]:(Number.isFinite(a)&&Number.isFinite(b)&&b>0?String(Math.round(a/b*100)):null);
  return sebV7Cap(label)+' : '+fmt(score[1])+' / '+fmt(score[2])+(p?' ('+fmt(p)+' % de réussite).':'.');
 }
 if(pct)return sebV7Cap(label)+' : '+fmt(pct[1])+' % de réussite.';
 const err=src.match(/(?:-|—)?\s*(\d+)\s*erreur(?:\(s\)|s)?/i);
 if(err)return sebV7Cap(label)+' : '+err[1]+' erreur'+(err[1]==='1'?'':'s')+'.';
 return'';
}
function sebV7Results(keys,text,max){
 const out=[];for(const k of keys){const r=sebV7Result(text(k),SEB_V7_LABELS[k]||k);if(r&&!out.includes(r))out.push(r);if(out.length>=(max||2))break}return out;
}
function sebV7Subject(id){return id&&id.subject?id.subject:'La personne'}
function sebV7Sentence(s){s=String(s||'').replace(/\s+/g,' ').trim();if(!s)return'';s=sebV7Cap(s);return /[.!?]$/.test(s)?s:s+'.'}
function sebV7GenericInsight(raw,id){let s=sebV7Clean(raw);if(!s||s.length<12||s.length>220)return'';const sub=sebV7Subject(id);if(/^la personne\b/i.test(s)){if(sub!=='La personne')s=s.replace(/^la personne\b/i,sub);return sebV7Sentence(s)}if(/^(?:il|elle|iel)\b/i.test(s))return sebV7Sentence(s);if(/^(?:a besoin|a des difficultés|réalise|comprend|ne sait|rencontre|présente|utilise|effectue|parvient|commet|oublie|identifie|respecte|demande|semble|fait)\b/i.test(s))return sebV7Sentence(sub+' '+sebV7Lower(s));if(/^(?:le|la|les|l’|l')\b/i.test(s))return sebV7Sentence(s);return''}
function sebV7Insights(key,raw,id){const src=sebV7Raw(raw),low=src.toLocaleLowerCase('fr-FR'),out=[];const push=x=>{x=sebV7Sentence(x);if(x&&!out.includes(x))out.push(x)};
 if(key==='fabrication-decoupe'){
  if(/découp.*(?:pas droites?|non droites?|incompl)/i.test(src))push('La découpe manque encore de régularité et certaines réalisations restent incomplètes');
  if(/cutter|contre[- ]sens|sens de découpe/i.test(src))push('L’utilisation de l’outil de découpe demande encore à être sécurisée');
 }
 if(key==='fabrication-tracage'&&/(?:pas aux dimensions|dimensions? indiquées?|dimension)/i.test(src))push('Le traçage reste lisible, mais les dimensions demandent davantage de contrôle');
 if(SEB_V7_GROUPS.fabrication.includes(key)&&/n['’]a pas besoin d['’]aide|sans aide/i.test(src))push('L’entrée dans l’exercice se fait sans aide');
 if(SEB_V7_GROUPS.briques.includes(key)&&/n['’]a pas besoin d['’]aide|sans aide/i.test(src))push('L’entrée dans l’activité se fait sans aide');
 if(key==='carre'&&/difficult.*(?:identifier|contrainte|relation)|contraintes?.*relations?/i.test(src))push('L’identification des contraintes et la mise en relation des éléments du problème restent difficiles');
 if(key==='organisation'&&/(?:nombreuses erreurs|beaucoup d['’]erreurs|accompagnement)/i.test(src))push('L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement');
 if(key==='planning'&&/contraintes?.*(?:oubli|erreur)|(?:oubli|erreur).*contraintes?/i.test(src))push('La prise en compte simultanée des contraintes doit encore être vérifiée');
 if(key==='tri-erreurs'&&/fiabilit[eé].*satisfaisante/i.test(src)){}else if(SEB_V7_GROUPS.tri.includes(key)&&/(?:fatigue|douleur|gêne)/i.test(src))push('Une fatigue ou une gêne a été observée au cours de cette activité');
 if(key==='texte'){
  if(/ne sait pas utiliser.*traitement de texte|traitement de texte.*(?:non maîtris|diffic)/i.test(src))push('Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché');
  else if(/a besoin d['’]aide|accompagnement/i.test(src))push('Certaines fonctions du traitement de texte nécessitent encore une aide');
 }
 if(key==='mail'){
  if(/a besoin d['’]aide.*(?:envoyer|message)|(?:envoyer|message).*a besoin d['’]aide/i.test(src))push('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées');
  else if(/oubli.*consigne/i.test(src))push('Certaines consignes restent à sécuriser lors de l’utilisation de la messagerie');
 }
 if(key==='expression'){
  if(/structure des phrases.*(?:correct|satisf)|idées? présentées? de manière ordonnée/i.test(src))push('La structuration des phrases et l’organisation des idées sont satisfaisantes');
  const trou=sebV7Metric(src,'Texte à trous'),par=sebV7Metric(src,'Paronymes'),gn=sebV7Metric(src,'Genre / Nombre'),dic=sebV7Metric(src,'Dictée');
  if(par!==null&&par>=.8)push('Le travail sur les paronymes constitue un point d’appui');
  if(gn!==null&&gn>=.7)push('Les accords de genre et de nombre sont globalement acquis');
  if(trou!==null&&trou<.5)push('Les automatismes de langue évalués dans le texte à trous restent fragiles');
  if(dic!==null&&dic<.5)push('L’orthographe en situation de dictée reste plus fragile');
 }
 if(key==='math-enonce'&&/comprend et exécute une consigne unique|consigne unique/i.test(src))push('La compréhension et l’exécution d’une consigne simple sont acquises');
 if(key==='math-problemes'&&/(?:erreurs?|difficult)/i.test(src)&&!/non évalu/i.test(src))push('La résolution des problèmes demande encore de la méthode et des vérifications');
 if(!out.length){const g=sebV7GenericInsight(src,id);if(g)push(g)}
 return out;
}
function sebV7GroupInsights(keys,text,id,max){const out=[],seen=new Set;for(const k of keys){for(const x of sebV7Insights(k,text(k),id)){const z=x.toLocaleLowerCase('fr-FR').replace(/[^a-zà-ÿ0-9]+/g,' ').trim();if(seen.has(z))continue;seen.add(z);out.push(x);if(out.length>=(max||2))return out}}return out}
function sebV7Split(level,keys){const r={I:[],II:[],III:[],NE:[]};for(const k of keys){const l=String(level(k)||'');if(r[l])r[l].push(SEB_V7_LABELS[k])}return r}
function sebV7Score(level,keys){const v=keys.map(k=>String(level(k)||'')).filter(x=>['I','II','III'].includes(x)).map(x=>x==='I'?3:x==='II'?2:1);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function sebV7Generate(level,text,id){
 id=id||{lead:'La personne',subject:'La personne'};const L=k=>String(level(k)||''),T=k=>String(text(k)||''),all=Object.values(SEB_V7_GROUPS).flat(),ev=all.filter(k=>['I','II','III'].includes(L(k))),nII=ev.filter(k=>L(k)==='II').length,nIII=ev.filter(k=>L(k)==='III').length,nNE=all.filter(k=>L(k)==='NE').length,p=[];
 let intro=id.lead+' a participé aux différentes mises en situation proposées au cours du plateau technique. ';if(!ev.length)intro+='Les éléments actuellement renseignés ne permettent pas encore de dégager une lecture globale du parcours.';else if(nIII===0&&nII<=Math.max(2,Math.floor(ev.length/3)))intro+='Les observations recueillies font ressortir des acquis globalement solides, avec quelques points qui restent à consolider.';else if(nIII<=2)intro+='Le parcours met en évidence plusieurs points d’appui, associés à des besoins d’accompagnement plus marqués dans certaines situations.';else intro+='Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.';p.push(intro);
 const f=sebV7Split(level,SEB_V7_GROUPS.fabrication);if(f.I.length||f.II.length||f.III.length||f.NE.length){let s='Dans les activités de fabrication, ';if(f.I.length>=3)s+='plusieurs acquis sont bien installés. '+sebV7Cap(sebV7Join(f.I))+' constituent des points d’appui dans la réalisation. ';else if(f.I.length)s+=sebV7Cap(sebV7Join(f.I))+' '+(f.I.length>1?'sont maîtrisés':'est maîtrisée')+'. ';if(f.II.length)s+=sebV7Cap(sebV7Join(f.II))+' '+(f.II.length>1?'demandent':'demande')+' encore davantage de contrôle et de précision. ';if(f.III.length)s+=sebV7Cap(sebV7Join(f.III))+' '+(f.III.length>1?'nécessitent':'nécessite')+' un accompagnement plus soutenu ou une méthode plus structurée. ';if(f.NE.length)s+='Les éléments non évalués ne sont pas interprétés. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.fabrication,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.fabrication,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const b=sebV7Split(level,SEB_V7_GROUPS.briques);if(b.I.length||b.II.length||b.III.length||b.NE.length){let s='La construction à base de briques apporte un éclairage complémentaire sur les capacités visuo-constructives. ';if(b.I.length===2)s+=sebV7Subject(id)+' comprend le schéma proposé et réalise l’assemblage avec une autonomie satisfaisante. ';else{if(b.I.length)s+=sebV7Cap(sebV7Join(b.I))+' constitue'+(b.I.length>1?'nt':'')+' un point d’appui. ';if(b.II.length)s+=sebV7Cap(sebV7Join(b.II))+' demande'+(b.II.length>1?'nt':'')+' encore quelques repères ou vérifications. ';if(b.III.length)s+=sebV7Cap(sebV7Join(b.III))+' nécessite'+(b.III.length>1?'nt':'')+' un accompagnement plus important. ';if(b.NE.length)s+='Une partie de cette activité n’a pas pu être appréciée. '}const e=sebV7GroupInsights(SEB_V7_GROUPS.briques,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.briques,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const ca=L('carre'),og=L('organisation'),pl=L('planning');if([ca,og,pl].some(x=>['I','II','III','NE'].includes(x))){let s='Les exercices de raisonnement, d’organisation et de planification permettent d’apprécier la manière dont '+(sebV7Subject(id)==='La personne'?'la personne':sebV7Subject(id).toLowerCase())+' traite plusieurs informations ou contraintes. ';if(ca==='I')s+='Le raisonnement sur une situation structurée est correctement mobilisé. ';else if(ca==='II')s+='Le raisonnement est accessible, mais la démarche gagne à être organisée et vérifiée. ';else if(ca==='III')s+='La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite. ';if(og==='I')s+='L’organisation d’une tâche comportant plusieurs critères est correctement appréhendée. ';else if(og==='II')s+='L’organisation de plusieurs informations est comprise, avec encore un besoin de vérification. ';else if(og==='III')s+='L’organisation de plusieurs informations constitue un point de fragilité plus marqué. ';if(pl==='I')s+='La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés. ';else if(pl==='II')s+='La planification est globalement comprise, malgré quelques erreurs dans la prise en compte des contraintes. ';else if(pl==='III')s+='La planification nécessite encore un accompagnement pour hiérarchiser les actions et maintenir un ordre cohérent. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.organisation,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.organisation,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const tt=L('tri-temps'),te=L('tri-erreurs');if([tt,te].some(x=>['I','II','III'].includes(x))){let s='Lors de l’activité de tri, ';if(tt==='I'&&te==='I')s+='le rythme de réalisation et la fiabilité sont satisfaisants. La tâche est menée avec régularité et le contrôle du travail reste adapté.';else if(te==='I'&&(tt==='II'||tt==='III'))s+='la réalisation reste fiable, mais le rythme est plus lent. La précision constitue un point d’appui alors que la vitesse d’exécution reste à renforcer.';else if(tt==='I'&&(te==='II'||te==='III'))s+='le rythme est adapté, mais la fiabilité demande davantage d’attention. Une vérification plus systématique permettrait de réduire les erreurs.';else s+='le rythme et la fiabilité restent à consolider afin de trouver un meilleur équilibre entre vitesse d’exécution et contrôle.';const e=sebV7GroupInsights(SEB_V7_GROUPS.tri,text,id,1);if(e.length&&!/fiabilité sont satisfaisants/i.test(s))s+=' '+e[0];const r=sebV7Results(SEB_V7_GROUPS.tri,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const tx=L('texte'),ma=L('mail');if([tx,ma].some(x=>['I','II','III','NE'].includes(x))){let s='Concernant les outils numériques, ';if(tx==='I')s+='le traitement de texte est utilisé avec une autonomie satisfaisante. ';else if(tx==='II')s+='le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères. ';else if(tx==='III')s+='le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées. ';else if(tx==='NE')s+='le traitement de texte n’a pas pu être évalué. ';if(ma==='I')s+='La messagerie électronique est maîtrisée dans les situations proposées. ';else if(ma==='II')s+='La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes. ';else if(ma==='III')s+='La messagerie électronique reste difficile à utiliser de manière autonome. ';else if(ma==='NE')s+='La messagerie électronique n’a pas pu être évaluée. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.numerique,text,id,2);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.numerique,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const ex=L('expression');if(['I','II','III','NE'].includes(ex)){let s='En expression écrite, ';if(ex==='I')s+='les compétences mobilisées dans les exercices proposés sont satisfaisantes. ';else if(ex==='II')s+='les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés. ';else if(ex==='III')s+='des difficultés persistent dans la structuration de l’écrit ou la maîtrise des règles de base, ce qui justifie un accompagnement plus soutenu. ';else s+='les éléments disponibles ne permettent pas de conclure. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.expression,text,id,5);if(e.length)s+=e.join(' ');const r=sebV7Results(SEB_V7_GROUPS.expression,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const me=L('math-enonce'),mp=L('math-problemes');if([me,mp].some(x=>['I','II','III','NE'].includes(x))){let s='En mathématiques, ';if(me==='I')s+='la compréhension des consignes et des énoncés constitue un point d’appui. ';else if(me==='II')s+='la compréhension des consignes est globalement accessible, même si certaines informations doivent être reformulées ou vérifiées. ';else if(me==='III')s+='la compréhension des consignes reste difficile et peut freiner l’entrée dans la résolution. ';else if(me==='NE')s+='la compréhension des consignes n’a pas pu être appréciée. ';if(mp==='I')s+='Les calculs et la résolution de problèmes sont réalisés de manière satisfaisante. ';else if(mp==='II')s+='Les calculs et la résolution de problèmes sont accessibles, avec encore quelques erreurs ou imprécisions. ';else if(mp==='III')s+='La mise en œuvre des calculs et la résolution de problèmes nécessite un accompagnement plus soutenu. ';else if(mp==='NE')s+='La partie consacrée aux calculs et à la résolution de problèmes n’ayant pas été évaluée, aucune conclusion n’est formulée sur ce volet. ';const e=sebV7GroupInsights(SEB_V7_GROUPS.maths,text,id,1);if(e.length)s+=e[0];const r=sebV7Results(SEB_V7_GROUPS.maths,text,2);if(r.length)s+=' '+r.join(' ');p.push(s.trim())}
 const abandoned=all.filter(k=>L(k)==='NE'&&/exercice abandonné/i.test(T(k))).length;if(abandoned)p.push((abandoned===1?'Une activité a été interrompue au cours du parcours. ':'Plusieurs activités ont été interrompues au cours du parcours. ')+'Les compétences correspondantes ne sont pas interprétées dans cette synthèse.');else if(nNE>=3)p.push('Plusieurs éléments sont restés non évalués. Ils ne sont pas interprétés et limitent les conclusions dans les domaines concernés.');
 const strengths=[],needs=[];const add=(a,l,s)=>{if(l&&!a.some(x=>x.l===l))a.push({l,s})};
 if(sebV7Score(level,SEB_V7_GROUPS.fabrication)>=2.6)add(strengths,'les activités techniques de fabrication',3);
 if(L('briques-identification')==='I'&&L('briques-manipulation')==='I')add(strengths,'la lecture de schéma et la manipulation',3);
 if(tt==='I'&&te==='I')add(strengths,'le rythme et la fiabilité dans le tri',3);
 if(pl==='I')add(strengths,'la planification',2);
 if(me==='I')add(strengths,'la compréhension des consignes mathématiques',2);
 if(ex==='I')add(strengths,'l’expression écrite',2);
 const need=(k,l,s)=>{const v=L(k);if(v==='III')add(needs,l,s+2);else if(v==='II')add(needs,l,s)};
 need('fabrication-decoupe','la précision dans la découpe',1);need('fabrication-tracage','le contrôle du traçage',1);need('fabrication-finition','la qualité des finitions',1);need('carre','le raisonnement',3);need('organisation','l’organisation de plusieurs informations',3);need('planning','la planification',2);need('texte','le traitement de texte',4);need('mail','l’utilisation autonome de la messagerie',2);need('expression','certains aspects de l’expression écrite',2);if(mp!=='NE')need('math-problemes','les calculs et la résolution de problèmes',3);
 strengths.sort((a,b)=>b.s-a.s);needs.sort((a,b)=>b.s-a.s);let c='Dans l’ensemble, ';const ss=strengths.slice(0,4).map(x=>x.l),nn=needs.slice(0,4).map(x=>x.l);if(ss.length)c+='les principaux points d’appui concernent '+sebV7Join(ss)+'. ';else c+='les acquis restent variables selon les situations proposées. ';if(nn.length)c+='Les besoins d’accompagnement se situent davantage dans '+sebV7Join(nn)+'. ';else c+='Les domaines effectivement évalués ne font pas apparaître de fragilité majeure nécessitant un accompagnement renforcé. ';c+='Le ressenti du stagiaire, renseigné séparément, complète cette lecture du parcours.';p.push(c);
 return sebV7Single(p.filter(Boolean).join('\n\n'));
}

window.sebV7SingleSummary=sebV7Single;
function c7(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
function r7(k){return document.querySelector('tr[data-r="'+k+'"]')}
function l7(k){const r=r7(k);return String(r?.dataset.level||r?.querySelector('.level.on')?.dataset.l||'')}
function t7(k){const r=r7(k);if(!r)return'';return [r.querySelector('.ctxt')?.value,r.querySelector('.detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')}
function install7(){const area=document.getElementById('seb-bilan-synthese-text'),old=document.getElementById('seb-generate-synthese');if(!area||!old)return;const clean=sebV7Single(area.value);if(clean!==String(area.value||'').trim()){area.value=clean;sessionStorage.setItem('seb_evalpro_bilan_synthese',clean)}const b=old.cloneNode(true);b.id='seb-generate-synthese';b.dataset.naturalV7='1';old.replaceWith(b);b.addEventListener('click',()=>{const value=window.sebV9Style(window.sebV8Polish(sebV7Generate(l7,t7,sebV7Identity(c7()))));area.value=value;sessionStorage.setItem('seb_evalpro_bilan_synthese',value);area.dispatchEvent(new Event('input',{bubbles:true}));const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Synthèse renforcée et individualisée — vous pouvez la modifier.'})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install7,160),{once:true});else setTimeout(install7,160);
})();

/* ---- migrated final runtime block ---- */

(()=>{'use strict';

function sebV8Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV8Polish(v){
 let s=sebV8Single(v);
 // Les observations déjà résumées par le domaine ne doivent pas être répétées comme une ligne de tableau.
 s=s.replace(/\s*L’entrée dans l’exercice se fait sans aide\./g,'');
 s=s.replace(/\s*L’entrée dans l’activité se fait sans aide\./g,'');
 s=s.replace(/\s*Les traits sont droits, le traçage est conforme aux spécificités du plan\./gi,'');
 s=s.replace(/le pliage et l’assemblage et les finitions/gi,'le pliage, l’assemblage et les finitions');

 // Fabrication : intégrer l’observation dans le constat au lieu de l’ajouter après.
 s=s.replace('La découpe demande encore davantage de contrôle et de précision. La découpe manque encore de régularité et certaines réalisations restent incomplètes.',
   'La découpe reste moins maîtrisée : elle manque encore de régularité et certaines réalisations restent incomplètes.');
 s=s.replace('La découpe demande encore davantage de contrôle et de précision.',
   'La découpe reste moins maîtrisée et demande encore davantage de contrôle et de précision.');
 s=s.replace('Le traçage et le repérage demandent encore davantage de contrôle et de précision. Le traçage reste lisible, mais les dimensions demandent davantage de contrôle.',
   'Le traçage reste lisible, mais le respect des dimensions demande encore davantage de contrôle.');

 // Raisonnement / organisation : l’observation précise le constat, elle ne le répète pas.
 if(s.includes('La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite.')&&s.includes('L’identification des contraintes et la mise en relation des éléments du problème restent difficiles.')){
  s=s.replace('La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite.',
    'La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite.');
  s=s.replace(/\s*L’identification des contraintes et la mise en relation des éléments du problème restent difficiles\./,'');
 }
 if(s.includes('L’organisation de plusieurs informations constitue un point de fragilité plus marqué.')&&s.includes('L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.')){
  s=s.replace('L’organisation de plusieurs informations constitue un point de fragilité plus marqué.',
    'L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.');
  s=s.replace(/\s*L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement\./,'');
 }

 // Numérique : fusionner niveau et commentaire concret dans une seule idée.
 if(s.includes('le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées.')&&s.includes('Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché.')){
  s=s.replace('le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées.',
    'le traitement de texte reste difficile et nécessite un accompagnement rapproché pour mobiliser les fonctions demandées.');
  s=s.replace(/\s*Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché\./,'');
 }
 if(s.includes('le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères.')&&s.includes('Certaines fonctions du traitement de texte nécessitent encore une aide.')){
  s=s.replace('le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions demandent encore des repères.',
    'le traitement de texte est accessible pour les tâches courantes, mais certaines fonctions nécessitent encore une aide ou des repères.');
  s=s.replace(/\s*Certaines fonctions du traitement de texte nécessitent encore une aide\./,'');
 }
 if(s.includes('La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.')&&s.includes('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.')){
  s=s.replace('La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes.',
    'La messagerie électronique est mieux appréhendée, mais l’envoi d’un message demande encore une aide et certaines consignes peuvent être oubliées.');
  s=s.replace(/\s*L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées\./,'');
 }
 if(s.includes('La messagerie électronique reste difficile à utiliser de manière autonome.')&&s.includes('L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.')){
  s=s.replace('La messagerie électronique reste difficile à utiliser de manière autonome.',
    'La messagerie électronique reste difficile à utiliser de manière autonome : l’envoi d’un message demande encore une aide et certaines consignes peuvent être oubliées.');
  s=s.replace(/\s*L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées\./,'');
 }

 // Mathématiques : ne pas redire deux fois que la compréhension d’une consigne est acquise.
 if(s.includes('En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui.')&&s.includes('La compréhension et l’exécution d’une consigne simple sont acquises.')){
  s=s.replace('En mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui.',
    'En mathématiques, la compréhension et l’exécution d’une consigne simple constituent un point d’appui.');
  s=s.replace(/\s*La compréhension et l’exécution d’une consigne simple sont acquises\./,'');
 }

 // Nettoyage final : espaces et éventuels doublons de paragraphes.
 s=s.replace(/[ \t]{2,}/g,' ').replace(/ +\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return sebV8Single(s);
}

window.sebV8Polish=sebV8Polish;
})();

/* ---- migrated final runtime block ---- */

(()=>{'use strict';

function sebV9Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV9Single(v){const s=String(v||'').replace(/\r\n/g,'\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\n\n')}
function sebV9BreakLongSentences(v){
 const paras=String(v||'').split(/\n\n+/);
 return paras.map(p=>{
  const sentences=p.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[p];
  const out=[];
  for(let sentence of sentences){
   sentence=sentence.trim();
   if(sentence.length>190&&sentence.includes(': ')){
    const i=sentence.indexOf(': '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+2).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push(sebV9Cap(b));continue}
   }
   if(sentence.length>190&&sentence.includes(', mais ')){
    const i=sentence.indexOf(', mais '),a=sentence.slice(0,i).trim(),b=sentence.slice(i+7).trim();
    if(a.length>45&&b.length>45){out.push((/[.!?]$/.test(a)?a:a+'.'));out.push('Cependant, '+b);continue}
   }
   out.push(sentence);
  }
  return out.join(' ');
 }).join('\n\n');
}
function sebV9Style(v){
 let s=sebV9Single(v);

 // Introduction : phrase plus courte et formulation moins catégorique.
 s=s.replace('Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.',
   'Le parcours met en évidence des compétences mobilisables dans plusieurs domaines. Des difficultés persistent toutefois et nécessitent encore un accompagnement dans certaines situations.');

 // Fabrication : éviter une longue énumération chargée de « et ».
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage, l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');
 s=s.replace('La lecture et la compréhension du plan, le traçage et le repérage, le pliage et l’assemblage et les finitions constituent des points d’appui dans la réalisation.',
   'La lecture du plan est bien maîtrisée. Le traçage et le repérage sont satisfaisants. Le pliage, l’assemblage et les finitions constituent également des points d’appui.');

 // Raisonnement / organisation : une idée principale par phrase.
 s=s.replace('La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite.',
   'La résolution d’un problème structuré reste difficile. L’identification des contraintes demande encore des repères. La mise en relation des différents éléments nécessite une méthode plus explicite.');
 s=s.replace('L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.',
   'L’organisation de plusieurs informations reste fragile. La prise en compte simultanée de plusieurs critères génère encore de nombreuses erreurs. Un accompagnement reste nécessaire dans ce type de situation.');

 // Expression écrite : alléger les phrases à deux constats.
 s=s.replace('En expression écrite, les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés.',
   'En expression écrite, les acquis sont présents mais restent hétérogènes. Certains éléments demandent encore à être consolidés.');
 s=s.replace('L’orthographe en situation de dictée reste plus fragile.','L’orthographe en situation de dictée reste fragile.');

 // Conclusion : répartir les listes sur plusieurs phrases et supprimer les chaînes de « et ».
 s=s.replace('Dans l’ensemble, les principaux points d’appui concernent les activités techniques de fabrication, la lecture de schéma et la manipulation, le rythme et la fiabilité dans le tri et la planification.',
   'Dans l’ensemble, les activités techniques de fabrication constituent un point d’appui important. La lecture de schéma et la manipulation sont également bien maîtrisées. Le rythme de travail, la fiabilité du tri et la planification complètent ces acquis.');
 s=s.replace('Les besoins d’accompagnement se situent davantage dans le traitement de texte, le raisonnement, l’organisation de plusieurs informations et l’utilisation autonome de la messagerie.',
   'Les besoins d’accompagnement concernent principalement le traitement de texte et le raisonnement. L’organisation de plusieurs informations reste également à consolider. L’utilisation autonome de la messagerie demande encore des repères.');

 s=sebV9BreakLongSentences(s);
 s=s.replace(/[ \t]{2,}/g,' ').replace(/ +\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
 return sebV9Single(s);
}

window.sebV9Style=sebV9Style;
})();

/* ---- migrated final runtime block ---- */

(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SEB_IA_ENGINE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='SEB-IA V1.2';
const META={
'fabrication-plan':['la lecture du plan','fabrication'],'fabrication-tracage':['le traçage','fabrication'],'fabrication-decoupe':['la découpe','fabrication'],'fabrication-assemblage':['le pliage et l’assemblage','fabrication'],'fabrication-finition':['les finitions','fabrication'],
'briques-identification':['la lecture du schéma','briques'],'briques-manipulation':['la manipulation et l’assemblage des briques','briques'],
'carre':['le raisonnement','organisation'],'organisation':['l’organisation','organisation'],'planning':['la planification','organisation'],
'tri-temps':['le rythme du tri','tri'],'tri-erreurs':['la fiabilité du tri','tri'],'texte':['le traitement de texte','numerique'],'mail':['la messagerie électronique','numerique'],
'expression':['l’expression écrite','fondamentaux'],'math-enonce':['la compréhension des consignes mathématiques','fondamentaux'],'math-problemes':['les calculs et la résolution de problèmes','fondamentaux']};
const GROUPS={fabrication:['fabrication-plan','fabrication-tracage','fabrication-decoupe','fabrication-assemblage','fabrication-finition'],briques:['briques-identification','briques-manipulation'],organisation:['carre','organisation','planning'],tri:['tri-temps','tri-erreurs'],numerique:['texte','mail'],fondamentaux:['expression','math-enonce','math-problemes']};
const TRACK=['satisfais','difficult','accompagnement','maîtris','autonom','repère','consolid','également','toutefois','revanche','cependant','correct','fragil','précision','contrôle','vérification','point d’appui','acquis','méthode','conforme'];
const VOCABULARY={
 support:['constitue un point d’appui','fait partie des acquis observés','est mobilisée de manière satisfaisante','est correctement appréhendée','ne fait pas apparaître de difficulté particulière','est correctement mise en œuvre','apparaît bien installée','est réalisée de manière adaptée','s’inscrit parmi les acquis repérés','est mise en œuvre sans difficulté particulière','est mobilisée conformément aux attentes','est bien installée dans la situation proposée'],
 consolidation:['reste à consolider sur certains aspects','demande encore quelques vérifications','nécessite encore des repères','gagne à être davantage contrôlée','reste perfectible dans la situation proposée','demande encore davantage de précision','reste à renforcer','nécessite un contrôle plus régulier','est globalement accessible, avec quelques points à sécuriser','demande encore un contrôle ponctuel','est en cours de consolidation','reste partiellement maîtrisée dans la situation proposée'],
 difficulty:['reste difficile et nécessite un accompagnement','constitue un point de fragilité plus marqué','demande encore une méthode plus structurée','reste peu maîtrisée dans la situation proposée','nécessite des repères plus soutenus','reste complexe à mettre en œuvre','demande un guidage plus important','nécessite une démarche plus explicite','demande un accompagnement plus régulier','reste difficile à mobiliser de manière autonome','nécessite une reprise méthodique','reste encore fragile dans la situation proposée'],
 addition:['Par ailleurs','De plus','Dans le même temps','Sur un autre registre','En complément'],
 contrast:['Toutefois','En revanche','Cependant','À l’inverse','Pour autant']
};
const FORBIDDEN=[/potentiel\b/i,/profil psycholog/i,/diagnostic/i,/motivation\b/i,/épanouissement/i,/orientation professionnelle/i,/insertion professionnelle/i,/fonctionnement cognitif/i,/capacité de concentration/i,/maintenir son attention/i];
const raw=v=>String(v==null?'':v).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const cap=v=>{const s=raw(v);return s?s[0].toUpperCase()+s.slice(1):''};
const lower=v=>{const s=raw(v);return s?s[0].toLowerCase()+s.slice(1):''};
const tone=v=>v==='I'?3:v==='II'?2:v==='III'?1:0;
function prepA(v){const x=raw(v);let y;if(/^le\s+/i.test(x))y='au '+x.replace(/^le\s+/i,'');else if(/^les\s+/i.test(x))y='aux '+x.replace(/^les\s+/i,'');else if(/^la\s+/i.test(x))y='à la '+x.replace(/^la\s+/i,'');else if(/^l[’']/i.test(x))y='à '+x;else y='à '+x;return y.replace(/\s+et\s+le\s+/gi,' et au ').replace(/\s+et\s+les\s+/gi,' et aux ').replace(/\s+et\s+la\s+/gi,' et à la ').replace(/\s+et\s+l[’']/gi,' et à l’')}
function prepDe(v){const x=raw(v);let y;if(/^le\s+/i.test(x))y='du '+x.replace(/^le\s+/i,'');else if(/^les\s+/i.test(x))y='des '+x.replace(/^les\s+/i,'');else if(/^la\s+/i.test(x))y='de la '+x.replace(/^la\s+/i,'');else if(/^l[’']/i.test(x))y='de '+x;else y='de '+x;return y.replace(/\s+et\s+le\s+/gi,' et du ').replace(/\s+et\s+les\s+/gi,' et des ').replace(/\s+et\s+la\s+/gi,' et de la ').replace(/\s+et\s+l[’']/gi,' et de l’')}
const norm=v=>raw(v).toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ');
const level=v=>['I','II','III','NE'].includes(raw(v).toUpperCase())?raw(v).toUpperCase():'';
const abandon=v=>/abandonn|renonc|interromp|refus(?:e|é|er)|ne souhaite pas (?:poursuivre|recommencer)/i.test(raw(v));
const notEval=v=>/non\s+évalu|n['’]a pas (?:pu|été) évalu|pas pu être appréci/i.test(raw(v));
function hash(v){let h=2166136261,s=String(v||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function ident(c){c=c||{};const civ=raw(c.civilite),n=raw(c.nom).toUpperCase(),p=raw(c.prenom||c['prénom']);if(/^m(?:\.|onsieur)?$/i.test(civ))return{lead:n?'Monsieur '+n:'Monsieur',sub:'Monsieur',pro:'il'};if(/^mme|madame$/i.test(civ))return{lead:n?'Madame '+n:'Madame',sub:'Madame',pro:'elle'};return{lead:n?(n+(p?' '+p:'')):'La personne',sub:'la personne',pro:'la personne'}}
function rowsOf(s){const out={};for(const k of Object.keys(META))out[k]={key:k,level:'',comment:''};for(const r of Array.isArray(s&&s.rows)?s.rows:[]){const k=raw(r&&r.key);if(!META[k])continue;const c=raw([r.comment,r.detail].map(raw).filter(Boolean).join(' ')).replace(/^(?:NE|I{1,3}|IV)\s*[.\-:;]\s*/i,'');out[k]={key:k,level:(abandon(c)||notEval(c))?'NE':level(r.level),comment:c}}return out}
function abandonsOf(s){const out=[];for(const r of Array.isArray(s&&s.abandons)?s.abandons:[]){if(!r||typeof r!=='object')continue;const exercice=raw(r.exercice||r.label||r.page||r.key),raisons=(Array.isArray(r.raisons)?r.raisons:[]).map(raw).filter(Boolean),commentaire=raw(r.commentaire||r.comment);if(!exercice&&!raisons.length&&!commentaire)continue;out.push({key:raw(r.key),exercice,raisons:[...new Set(raisons)],commentaire})}return out}
function fp(s,rows){const c=s&&s.candidate||{},a=[raw(c.candidateId),raw(c.nom),raw(c.prenom),raw(c.date),raw(c.lieu),raw(c.groupe)];for(const k of Object.keys(META))a.push(k,rows[k].level,norm(rows[k].comment));for(const r of abandonsOf(s))a.push('abandon',r.key,r.exercice,r.raisons.join('~'),norm(r.commentaire));return hash(a.join('|')).toString(16).padStart(8,'0')}
function patternOf(v){const x=raw(v).toLocaleLowerCase('fr-FR');if(!x)return'';if(/\b(?:nécessite|nécessitent)\b/.test(x))return'necessite';if(/\b(?:demande|demandent)\b/.test(x))return'demande';if(/\breste(?:nt)?\b/.test(x))return'reste';if(/\bconstitue(?:nt)?\b/.test(x))return'constitue';if(/\bmise en\b|\bmettre en\b/.test(x))return'mise-en';if(/\bavec\s+\d+(?:[.,]\d+)?\s*%/.test(x))return'avec-pourcentage';if(/\b(?:résultat|score)\b/.test(x))return'resultat-score';if(/\bpoint d[’']appui\b/.test(x))return'point-appui';if(/\best (?:correctement|globalement|bien|réalis|mobilis|utilis|accessible|maîtris)/.test(x))return'est-qualificatif';return''}
function shapeOf(v){const x=raw(v).toLocaleLowerCase('fr-FR');if(!x)return'';if(/^la compétence liée\b/.test(x))return'shape-competence';if(/^la mise en œuvre\b/.test(x))return'shape-mise-en-oeuvre';if(/^les résultats?\b|^le résultat\b/.test(x))return'shape-resultat';if(/^des difficultés\b/.test(x))return'shape-difficultes';if(/^(?:des vérifications|quelques repères)\b/.test(x))return'shape-reperes';if(/^la partie consacrée\b/.test(x))return'shape-partie';if(/^(?:concernant|pour)\b/.test(x))return'shape-preposition';if(/^(?:dans|lors|sur|en)\b/.test(x))return'shape-contexte';if(/^la situation\b/.test(x))return'shape-situation';return''}
function Styler(seed){this.seed=hash(seed);this.n=0;this.used=new Map;this.words=new Map;this.conn=new Map;this.families=new Map;this.patterns=new Map;this.shapes=new Map}
Styler.prototype.pick=function(key,a){a=(a||[]).filter(Boolean).map((v,i)=>typeof v==='string'?{text:v,family:'',pattern:patternOf(v),shape:shapeOf(v),i}:{text:raw(v.text),family:raw(v.family),pattern:raw(v.pattern)||patternOf(v.text),shape:raw(v.shape)||shapeOf(v.text),i});if(!a.length)return'';let best=a[0],score=1e9;for(const item of a){const low=item.text.toLocaleLowerCase('fr-FR');let sc=(this.used.get(item.text)||0)*1000+(item.family?(this.families.get(item.family)||0)*420:0)+(item.pattern?(this.patterns.get(item.pattern)||0)*360:0)+(item.shape?(this.shapes.get(item.shape)||0)*520:0)+(hash(this.seed+'|'+key+'|'+item.i+'|'+this.n)%83);for(const w of TRACK)if(low.includes(w))sc+=(this.words.get(w)||0)*90;if(sc<score){score=sc;best=item}}this.n++;this.used.set(best.text,(this.used.get(best.text)||0)+1);if(best.family)this.families.set(best.family,(this.families.get(best.family)||0)+1);if(best.pattern)this.patterns.set(best.pattern,(this.patterns.get(best.pattern)||0)+1);if(best.shape)this.shapes.set(best.shape,(this.shapes.get(best.shape)||0)+1);const low=best.text.toLocaleLowerCase('fr-FR');for(const w of TRACK)if(low.includes(w))this.words.set(w,(this.words.get(w)||0)+1);return best.text};
Styler.prototype.connector=function(kind){const b=kind==='softContrast'?['Toutefois','Cependant','Pour autant']:(kind==='contrast'?VOCABULARY.contrast:VOCABULARY.addition);let best=b[0],score=1e9;for(let i=0;i<b.length;i++){const sc=(this.conn.get(b[i])||0)*1000+(hash(this.seed+'|c|'+kind+'|'+i+'|'+this.n)%97);if(sc<score){score=sc;best=b[i]}}this.conn.set(best,(this.conn.get(best)||0)+1);this.n++;return best};
function join(a,st,key){a=(a||[]).map(raw).filter(Boolean);if(a.length<2)return a[0]||'';const last=a[a.length-1],complexLast=/\bet\b/i.test(last),complexBefore=a.slice(0,-1).some(x=>/\bet\b/i.test(x));if(a.length===2){const link=(complexLast||complexBefore)?' ainsi que ':st.pick('join:'+key,[' et ',' ainsi que ']);return a[0]+link+last}const link=(complexLast||complexBefore)?', ainsi que ':st.pick('join:'+key,[' et ', ', ainsi que ']);return a.slice(0,-1).join(', ')+link+last}
function sent(v){let s=cap(v).replace(/\s+([,.])/g,'$1').replace(/\s*([;:!?])\s*/g,' $1 ');s=s.replace(/\s{2,}/g,' ').trim();if(s&&!/[.!?]$/.test(s))s+='.';return s}
function para(a){const out=[];for(let s of a||[]){s=sent(s);if(!s)continue;if(s.length>230){const m=s.match(/^(.{60,145}?)(?:; |: |, mais |, tandis que )(.{55,})$/);if(m){out.push(sent(m[1]));out.push(sent('Cependant, '+m[2]));continue}}if(!out.some(x=>norm(x)===norm(s)))out.push(s)}return out.join(' ')}
function metric(c){c=raw(c);const p=[...c.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)];const e=[...c.matchAll(/(\d+)\s*erreur(?:\(s\)|s)?/gi)];const t=c.match(/(?:moyenne|temps moyen)\s*(?:de\s*)?(\d{1,2})\s*(?::|min(?:ute)?s?)\s*(\d{1,2})/i);return{pct:p.length?p[p.length-1][1]:null,err:e.length?e[e.length-1][1]:null,time:t?{m:+t[1],s:+t[2]}:null}}
function withPct(base,pct,st,key){const p=String(pct).replace('.',',');return st.pick('pct:'+key,[{text:base+', avec '+p+' % de réponses correctes',family:'pct-avec',pattern:'avec-pourcentage'},{text:base+' ; le résultat atteint '+p+' % de réponses correctes',family:'pct-resultat',pattern:'resultat-score'},{text:base+', le score relevé étant de '+p+' %',family:'pct-score',pattern:'resultat-score'},{text:base+' ; '+p+' % de réponses sont correctes',family:'pct-direct',pattern:'pourcentage-direct'}])}
function reported(c,id){const s=raw(c),m=s.match(/(?:monsieur|madame|la personne|le candidat)?\s*(?:a\s+)?(?:indiqu[eé]|signal[eé]|confie|déclare|précise|exprime|reconnaît)\s+(?:qu['’])?(.{8,180}?)(?:[.!?]|$)/i);return m?`${id.sub} indique que ${m[1].replace(/^que\s+/i,'')}`:''}
function specific(k,r,id,st){
 const s=raw(r.comment),out=[],pick=(name,a)=>st?st.pick('detail:'+k+':'+name,a):raw((a[0]&&a[0].text)||a[0]);
 if(k==='fabrication-plan'){
   if(/n['’]a pas besoin d['’]aide|sans aide/i.test(s))out.push(pick('aide',[{text:'l’entrée dans l’exercice se fait sans aide particulière',family:'autonomie'},{text:'le démarrage de l’activité ne nécessite pas d’aide',family:'autonomie'}]));
   else if(/consignes supplémentaires/i.test(s)&&!/montre un exemple|gabarit/i.test(s))out.push(pick('consignes',[{text:'le démarrage de l’exercice nécessite encore des consignes supplémentaires',family:'reperes'},{text:'des consignes complémentaires restent nécessaires pour entrer dans l’activité',family:'aide'}]));
   else if(/montre un exemple|gabarit/i.test(s))out.push(pick('modele',[{text:'un exemple ou un gabarit reste nécessaire pour commencer l’exercice',family:'modele'},{text:'l’entrée dans l’activité nécessite encore l’appui d’un exemple ou d’un gabarit',family:'modele'}]));
 }
 if(k==='fabrication-tracage'){
   if(/conforme aux spécificités du plan/i.test(s))out.push(pick('tracage-ok',[{text:'le traçage est conforme aux spécificités du plan',family:'conforme'},{text:'les traits sont réguliers et respectent les indications du plan',family:'conforme'}]));
   else if(/pas aux dimensions|dimension/i.test(s)&&!/ne sont pas droits/i.test(s))out.push(pick('dimensions',[{text:'le traçage reste lisible, mais le respect des dimensions nécessite davantage de contrôle',family:'controle'},{text:'les traits sont correctement réalisés ; le respect des mesures demande toutefois davantage de précision',family:'precision'},{text:'la qualité du tracé est satisfaisante, tandis que les dimensions restent à vérifier plus attentivement',family:'verification'}]));
   else if(/traits ne sont pas droits|pas droits.*dimensions|dimensions.*pas droits/i.test(s))out.push(pick('tracage-ko',[{text:'la régularité des traits et le respect des dimensions restent à renforcer',family:'precision'},{text:'le traçage ne respecte pas encore suffisamment la rectitude des traits ni les dimensions attendues',family:'controle'}]));
 }
 if(k==='fabrication-decoupe'){
   if(/conforme/i.test(s))out.push(pick('decoupe-ok',[{text:'les opérations de découpe sont conformes aux attentes',family:'conforme'},{text:'la découpe est réalisée de manière conforme',family:'conforme'}]));
   if(/pas droites?|incompl/i.test(s))out.push(pick('decoupe-ko',[{text:'la découpe manque encore de régularité et certaines réalisations restent incomplètes',family:'regularite'},{text:'la précision de la découpe reste à renforcer, certaines parties demeurant incomplètes',family:'precision'}]));
   if(/ciseaux/i.test(s))out.push(pick('ciseaux',[{text:'l’utilisation des ciseaux n’est pas toujours adaptée à la situation proposée',family:'outil'},{text:'les ciseaux ne sont pas toujours utilisés de manière adaptée au cours de la découpe',family:'outil'}]));
 }
 if(k==='fabrication-assemblage'){
   if(/sans aide|n['’]a pas besoin d['’]aide/i.test(s)&&/conforme/i.test(s))out.push(pick('assemblage-ok',[{text:'le pliage et l’assemblage sont réalisés sans aide, avec un résultat conforme',family:'autonomie'},{text:'l’assemblage est mené sans aide particulière et le résultat obtenu est conforme',family:'conforme'}]));
   else if(/consignes supplémentaires/i.test(s))out.push(pick('assemblage-consignes',[{text:'des consignes supplémentaires restent nécessaires pour réaliser l’assemblage',family:'reperes'},{text:'l’assemblage est accessible, mais demande encore des indications complémentaires',family:'aide'}]));
   else if(/besoin d['’]aide.*assembler|assemblage n['’]est pas correct/i.test(s))out.push(pick('assemblage-aide',[{text:'l’assemblage nécessite encore une aide ou le résultat obtenu reste incorrect selon la situation observée',family:'aide'},{text:'la réalisation de l’assemblage reste difficile et demande encore un appui',family:'accompagnement'}]));
 }
 if(k==='fabrication-finition'){
   if(/aspect du produit est conforme|travail est minutieux/i.test(s))out.push(pick('finitions-ok',[{text:'l’aspect final est conforme aux exigences et le travail réalisé est minutieux',family:'conforme'},{text:'les finitions répondent aux exigences attendues',family:'conforme'}]));
   else if(/pas ou peu de finition/i.test(s))out.push(pick('finitions-ko',[{text:'les finitions sont peu présentes et l’aspect final ne répond pas encore aux exigences',family:'finition'},{text:'le travail de finition reste très limité dans la réalisation observée',family:'finition'}]));
   else if(/n['’]est pas conforme|pas effectuées? avec précision|imprécis/i.test(s))out.push(pick('finitions',[{text:'les finitions restent imprécises et l’aspect final ne répond pas encore pleinement aux exigences',family:'precision'},{text:'l’aspect final reste à améliorer, les opérations de finition manquant encore de précision',family:'finition'},{text:'les finitions demandent davantage de soin afin d’obtenir un résultat conforme aux exigences',family:'conforme'}]));
 }
 if(k==='briques-identification'){
   if(/n['’]a pas besoin d['’]aide|sans aide/i.test(s))out.push(pick('brique-schema-ok',[{text:'la lecture du schéma permet de commencer l’exercice sans aide particulière',family:'autonomie'},{text:'l’entrée dans l’exercice à partir du schéma se fait sans aide',family:'autonomie'}]));
   else if(/consignes supplémentaires/i.test(s)&&!/montre un exemple/i.test(s))out.push(pick('brique-schema-consignes',[{text:'des consignes supplémentaires restent nécessaires pour démarrer à partir du schéma',family:'reperes'},{text:'la lecture initiale du schéma demande encore des indications complémentaires',family:'aide'}]));
   else if(/montre un exemple/i.test(s))out.push(pick('brique-schema-modele',[{text:'le démarrage nécessite des consignes supplémentaires ainsi qu’un exemple',family:'modele'},{text:'un exemple reste nécessaire en complément des consignes pour commencer l’assemblage',family:'modele'}]));
 }
 if(k==='briques-manipulation'){
   if(/sans difficultés/i.test(s))out.push(pick('brique-manip-ok',[{text:'la manipulation et l’assemblage des pièces sont réalisés sans difficulté particulière',family:'autonomie'},{text:'les pièces sont assemblées de manière adaptée',family:'conforme'}]));
   else if(/reconnait|reconnaît/i.test(s)&&/assemble avec difficulté/i.test(s))out.push(pick('brique-manip-ii',[{text:'les pièces sont reconnues, mais leur assemblage reste difficile',family:'difficulte'},{text:'l’identification des pièces est acquise tandis que la manipulation demande encore des repères',family:'reperes'}]));
   else if(/bonne position|long voire impossible/i.test(s))out.push(pick('brique-manip-iii',[{text:'le positionnement des pièces reste difficile et ralentit fortement l’assemblage',family:'positionnement'},{text:'la présentation des pièces dans la bonne position nécessite encore un accompagnement important',family:'accompagnement'}]));
 }
 if(k==='carre'){
   if(/identifier les contraintes.*analyser les relations.*déduire une solution/i.test(s))out.push(pick('carre-i',[{text:'les contraintes sont identifiées, mises en relation et permettent d’aboutir à une solution',family:'raisonnement'},{text:'le problème structuré est traité en identifiant les contraintes et leurs relations',family:'raisonnement'}]));
   else if(/résoudre partiellement les relations/i.test(s))out.push(pick('carre-ii',[{text:'les contraintes sont identifiées, mais leur mise en relation reste partielle',family:'contraintes'},{text:'le raisonnement permet d’identifier les contraintes, mais la résolution de leurs relations reste partielle',family:'consolidation'}]));
   else if(/difficult.*identifier|contraintes?.*relations?/i.test(s))out.push(pick('contraintes',[{text:'l’identification des contraintes et leur mise en relation restent difficiles',family:'contraintes'},{text:'le raisonnement sur les contraintes demande encore une méthode plus explicite',family:'methode'},{text:'la mise en relation des différents éléments du problème reste fragile',family:'fragilite'}]));
 }
 if(k==='organisation'){
   if(/autonome sans erreur significative/i.test(s))out.push(pick('organisation-i',[{text:'la tâche de gestion de stock multicritère est réalisée de manière autonome, sans erreur significative',family:'autonomie'},{text:'les différents critères sont pris en compte de manière autonome',family:'organisation'}]));
   else if(/multicritère.*produit des erreurs/i.test(s))out.push(pick('organisation-ii',[{text:'la tâche multicritère est comprise, mais des erreurs subsistent dans son exécution',family:'consolidation'},{text:'plusieurs critères sont pris en compte, avec encore des erreurs à contrôler',family:'controle'}]));
   else if(/nombreuses erreurs|plus de\s*10|accompagnement/i.test(s))out.push(pick('organisation',[{text:'la prise en compte simultanée de plusieurs critères génère encore des erreurs et nécessite des repères',family:'reperes'},{text:'l’organisation de plusieurs informations reste difficile et demande un accompagnement',family:'accompagnement'},{text:'le classement selon plusieurs critères nécessite encore une démarche plus structurée',family:'methode'}]));
 }
 if(k==='planning'){
   if(/n['’]est pas en capacité de déterminer l['’]ordre|ne (?:parvient|réussit) pas.*ordre/i.test(s))out.push(pick('planning',[{text:'l’enchaînement des tâches reste difficile et l’ordre d’exécution n’est pas encore correctement déterminé',family:'ordre'},{text:'la planification reste fragile lorsqu’il faut ordonner les différentes tâches',family:'fragilite'},{text:'la mise en ordre des tâches nécessite encore des repères pour construire un enchaînement cohérent',family:'reperes'}]));
   else if(/(?:est en )?capacité de déterminer l['’]ordre|capable de déterminer l['’]ordre/i.test(s)){
     if(/mais produit des erreurs/i.test(s))out.push(pick('planning-ii',[{text:'l’ordre d’exécution est globalement identifié, avec encore quelques erreurs',family:'consolidation'},{text:'la planification est accessible, mais l’enchaînement comporte encore des erreurs',family:'ordre'}]));
     else out.push(pick('planning-i',[{text:'l’ordre d’exécution des tâches est correctement déterminé',family:'ordre'},{text:'la succession des tâches est organisée de manière cohérente',family:'planification'}]));
   }else if(/ordre d['’]exécution|ordre.*tâches/i.test(s))out.push(pick('planning',[{text:'l’enchaînement des tâches reste difficile et l’ordre d’exécution n’est pas encore correctement déterminé',family:'ordre'},{text:'la planification reste fragile lorsqu’il faut ordonner les différentes tâches',family:'fragilite'},{text:'la mise en ordre des tâches nécessite encore des repères pour construire un enchaînement cohérent',family:'reperes'}]));
 }
 if(k==='texte'){
   if(/sait utiliser.*traitement de texte|présentable à un tiers/i.test(s)&&!/besoin d['’]aide/i.test(s))out.push(pick('texte-ok',[{text:'le traitement de texte est utilisé de manière autonome pour produire un document présentable',family:'autonomie'},{text:'les fonctions nécessaires à la présentation du document sont correctement mobilisées',family:'correctement'}]));
   else if(/besoin d['’]aide|aide.*logiciel/i.test(s))out.push(pick('texte-aide',[{text:'une aide reste nécessaire pour mobiliser certaines fonctions du traitement de texte',family:'aide'},{text:'le traitement de texte est accessible, mais certaines opérations nécessitent encore un appui',family:'appui'},{text:'la production d’un document présentable demande encore des repères dans l’utilisation du logiciel de traitement de texte',family:'reperes'}]));
   else if(/ne sait pas utiliser.*traitement de texte/i.test(s))out.push(pick('texte-ko',[{text:'l’utilisation du traitement de texte reste difficile dans la situation proposée',family:'difficulte'},{text:'les fonctions demandées du traitement de texte nécessitent encore un accompagnement important',family:'accompagnement'}]));
 }
 if(k==='mail'){
   if(/capable d['’]envoyer seul|capable d['’]envoyer seule|sans aide|autonom/i.test(s))out.push(pick('mail-ok',[{text:'l’envoi d’un message est réalisé de manière autonome',family:'autonomie'},{text:'la messagerie électronique est utilisée sans aide dans la situation proposée',family:'autonomie'}]));
   else if(/besoin d['’]aide.*envoyer|oublis de consignes/i.test(s))out.push(pick('mail-ii',[{text:'l’envoi du message reste accessible, mais demande encore une aide ou une vérification des consignes',family:'aide'},{text:'la messagerie est utilisée avec encore quelques oublis ou besoins d’appui',family:'reperes'}]));
   else if(/ne sait pas utiliser une messagerie/i.test(s))out.push(pick('mail-iii',[{text:'l’utilisation de la messagerie reste difficile dans la situation proposée',family:'difficulte'},{text:'les fonctions demandées en messagerie nécessitent encore un accompagnement important',family:'accompagnement'}]));
   if(/objet/i.test(s)&&/pi[eè]ce jointe/i.test(s))out.push('le courriel ne comporte pas l’ensemble des éléments attendus, notamment l’objet et la pièce jointe');else if(/pi[eè]ce jointe/i.test(s))out.push('la gestion de la pièce jointe reste à sécuriser');
 }
 if(k==='expression'){
   if(/structure des phrases.*(?:correct|satisf)|idées?.*(?:ordonn|organis)/i.test(s))out.push(pick('expression-structure',[{text:'la structuration des phrases et l’organisation des idées sont satisfaisantes',family:'satisfaisant'},{text:'les phrases sont globalement bien structurées et les idées sont présentées de manière ordonnée',family:'structure'},{text:'l’organisation des idées constitue un point d’appui dans la production écrite',family:'support'}]));
   if(/lexique approprié|textes? cohérent/i.test(s))out.push(pick('expression-i',[{text:'le lexique employé est adapté et l’écrit reste cohérent',family:'lexique'},{text:'la production écrite mobilise un lexique approprié et conserve une bonne cohérence',family:'coherence'}]));
   if(/orthographe.*(?:pas|n['’]est pas).*correct/i.test(s))out.push('l’orthographe et la structuration de l’écrit restent fragiles');
 }
 if(k==='math-enonce'){
   if(/comprend et exécute une consigne unique/i.test(s))out.push(pick('math-enonce-i',[{text:'la consigne unique est comprise et exécutée correctement',family:'consigne'},{text:'la compréhension et l’exécution de la consigne constituent un point d’appui',family:'support'}]));
   else if(/partiellement une consigne unique/i.test(s))out.push(pick('math-enonce-ii',[{text:'la consigne est comprise et exécutée seulement en partie',family:'consolidation'},{text:'la compréhension de la consigne reste partielle dans la situation proposée',family:'reperes'}]));
   else if(/n['’]a pas su exécuter une consigne unique/i.test(s))out.push(pick('math-enonce-iii',[{text:'l’exécution de la consigne reste difficile malgré sa présentation',family:'difficulte'},{text:'des repères supplémentaires restent nécessaires pour traiter la consigne',family:'reperes'}]));
 }
 if(k==='math-problemes'){
   if(/capable de calculer.*algorithmes.*pourcentages.*échelles/i.test(s))out.push(pick('math-problemes-i',[{text:'les calculs et problèmes de pourcentages ou d’échelles sont traités de manière adaptée',family:'calcul'},{text:'les situations de calcul et de résolution de problèmes sont correctement mobilisées',family:'support'}]));
   else if(/quelques erreurs ou imprécisions/i.test(s))out.push(pick('math-problemes-ii',[{text:'les calculs sont accessibles, avec encore quelques erreurs ou imprécisions dans les problèmes proposés',family:'consolidation'},{text:'la résolution de problèmes reste globalement accessible mais demande davantage de vérification',family:'verification'}]));
   else if(/stratégies inappropriées|sans liens avec les exigences/i.test(s))out.push(pick('math-problemes-iii',[{text:'les stratégies mobilisées ne répondent pas encore aux exigences de la situation',family:'strategie'},{text:'la résolution de problèmes nécessite encore une méthode plus adaptée aux contraintes proposées',family:'methode'}]));
 }
 const rep=reported(s,id);if(rep)out.push(rep);return out
}
function phraseFor(r,st,key){const l=META[r.key][0],embedded=/^(?:num:|fund:)/.test(raw(key)),usable=bank=>embedded?bank.filter(x=>!['shape-preposition','shape-contexte'].includes(raw(x&&x.shape))):bank;if(r.level==='I'){const bank=VOCABULARY.support.map((p,i)=>({text:'La compétence liée '+prepA(l)+' '+p,family:'support-'+i,shape:'shape-competence'}));bank.push({text:'Les résultats observés concernant '+l+' sont satisfaisants',family:'satisfaisant',shape:'shape-resultat'},{text:'La mise en œuvre '+prepDe(l)+' répond aux attentes de la situation',family:'attentes',shape:'shape-mise-en-oeuvre'},{text:'Dans cette situation, '+l+' ne fait pas apparaître de difficulté particulière',family:'absence-difficulte',shape:'shape-contexte'},{text:'Concernant '+l+', les éléments observés répondent aux attentes',family:'attentes',shape:'shape-preposition'},{text:'Pour '+l+', les acquis sont correctement mobilisés',family:'acquis',shape:'shape-preposition'});return st.pick(key+':I',usable(bank))}if(r.level==='II'){const bank=VOCABULARY.consolidation.map((p,i)=>({text:'La compétence liée '+prepA(l)+' '+p,family:'consolidation-'+i,shape:'shape-competence'}));bank.push({text:'Des vérifications restent utiles concernant '+l,family:'verification',shape:'shape-reperes'},{text:'Quelques repères restent nécessaires pour '+l,family:'reperes',shape:'shape-reperes'},{text:'La mise en œuvre '+prepDe(l)+' reste à renforcer',family:'renforcer',shape:'shape-mise-en-oeuvre'},{text:'Pour '+l+', certains points restent à consolider',family:'consolider',shape:'shape-preposition'},{text:'Concernant '+l+', un contrôle plus régulier reste utile',family:'controle',shape:'shape-preposition'},{text:'Les éléments observés pour '+l+' restent à consolider',family:'consolider',shape:'shape-resultat'});return st.pick(key+':II',usable(bank))}if(r.level==='III'){const bank=VOCABULARY.difficulty.map((p,i)=>({text:'La compétence liée '+prepA(l)+' '+p,family:'difficulty-'+i,shape:'shape-competence'}));bank.push({text:'Des difficultés marquées concernent '+l,family:'difficultes',shape:'shape-difficultes'},{text:'La mise en œuvre '+prepDe(l)+' nécessite une démarche plus structurée',family:'methode',shape:'shape-mise-en-oeuvre'},{text:'Pour '+l+', un accompagnement plus soutenu reste nécessaire',family:'accompagnement',shape:'shape-preposition'},{text:'Concernant '+l+', des repères plus soutenus restent nécessaires',family:'reperes',shape:'shape-preposition'},{text:'La situation met en évidence des difficultés concernant '+l,family:'difficultes',shape:'shape-situation'});return st.pick(key+':III',usable(bank))}if(r.level==='NE'){const interrupted=abandon(r.comment);return st.pick(key+':NE',interrupted?[{text:'La partie consacrée '+prepA(l)+' a été interrompue et reste hors interprétation',family:'ne-interrompu',shape:'shape-partie'},{text:'Concernant '+l+', l’activité a été interrompue et les éléments non réalisés restent hors interprétation',family:'ne-interrompu',shape:'shape-preposition'},{text:'L’interruption de l’activité ne permet pas d’interpréter '+l,family:'ne-interrompu',shape:'shape-situation'}]:[{text:'La partie consacrée '+prepA(l)+' n’a pas pu être évaluée',family:'ne',shape:'shape-partie'},{text:'Les éléments relatifs '+prepA(l)+' restent hors interprétation faute d’évaluation',family:'ne',shape:'shape-resultat'},{text:'Concernant '+l+', aucun résultat n’est retenu puisque l’évaluation n’a pas pu être menée',family:'ne',shape:'shape-preposition'}])}return''}
function intro(rows,id,st){const all=Object.values(rows),ev=all.filter(r=>['I','II','III'].includes(r.level)),ne=all.filter(r=>r.level==='NE').length,a=ev.filter(r=>r.level==='I').length,b=ev.filter(r=>r.level==='II').length,c=ev.filter(r=>r.level==='III').length;let lead;if(ne>0&&ne>=ev.length)lead=st.pick('intro-lead-partial',[id.lead+' a participé au parcours d’évaluation proposé sur le plateau technique',id.lead+' a pris part aux situations d’évaluation proposées, dont une partie n’a pas pu être évaluée',id.lead+' a engagé le parcours du plateau technique, avec plusieurs situations restant non évaluées']);else lead=st.pick('intro-lead',[id.lead+' a participé aux différentes mises en situation proposées au cours du plateau technique',id.lead+' a pris part aux exercices proposés dans le cadre du plateau technique',id.lead+' a réalisé les différentes situations d’évaluation du plateau technique']);if(!ev.length)return lead+'. Les éléments renseignés ne permettent pas encore de dégager une lecture globale du parcours.';let second;if(c===0&&b<=Math.max(2,Math.floor(ev.length/3)))second=st.pick('intro-good',['Les observations font ressortir des acquis globalement solides, avec quelques points à consolider','Le parcours met en évidence de nombreux acquis et quelques besoins de vérification','Les compétences observées sont dans l’ensemble bien mobilisées']);else if(c===0)second=st.pick('intro-consolidation',['Le parcours fait apparaître des acquis associés à plusieurs points restant à consolider','Les résultats montrent des compétences mobilisées, avec plusieurs éléments demandant encore des repères ou des vérifications','L’évaluation met en évidence des acquis partiels et plusieurs compétences encore en cours de consolidation']);else if(c<=2)second=st.pick('intro-mix',['Le parcours fait apparaître plusieurs points d’appui, associés à des difficultés plus marquées dans certaines situations','Les résultats sont contrastés selon les domaines, avec des acquis identifiés et des besoins d’accompagnement ciblés','L’évaluation met en évidence un profil hétérogène, alternant réussites et points à consolider']);else second=st.pick('intro-hard',['Plusieurs compétences sont mobilisables, mais des difficultés importantes persistent dans différents domaines','Le parcours met en évidence quelques points d’appui, associés à des besoins d’accompagnement importants','Les observations montrent des acquis partiels et plusieurs difficultés nécessitant encore des repères']);return lead+'. '+second+'.'}
function fabrication(rows,id,st){const g=GROUPS.fabrication.map(k=>rows[k]).filter(r=>r.level);if(!g.length)return'';const groups={I:g.filter(r=>r.level==='I'),II:g.filter(r=>r.level==='II'),III:g.filter(r=>r.level==='III'),NE:g.filter(r=>r.level==='NE')},a=[];const open=st.pick('fabOpen',['Dans les activités de fabrication','Lors de la fabrication de la structure','Concernant les opérations de fabrication','Sur le volet fabrication']);if(groups.I.length){const ls=groups.I.map(r=>META[r.key][0]);a.push(st.pick('fabI',[{text:open+', les principaux acquis concernent '+join(ls,st,'fabI'),family:'acquis'},{text:open+', '+join(ls,st,'fabI2')+(ls.length>1?' constituent des points d’appui':' constitue un point d’appui'),family:'support'},{text:open+', les réalisations sont satisfaisantes pour '+join(ls,st,'fabI3'),family:'satisfaisant'}]))}else a.push(open+', plusieurs compétences sont observées');for(const L of ['II','III']){const detailed=[],generic=[];for(const r of groups[L]){const d=specific(r.key,r,id,st);if(d.length)detailed.push(...d);else generic.push(r)}if(generic.length){const ls=join(generic.map(r=>META[r.key][0]),st,'fab-'+L);a.push(L==='II'?st.pick('fabII',[{text:'Des points restent à consolider concernant '+ls,family:'consolider'},{text:'Des vérifications supplémentaires restent utiles pour '+ls,family:'verification'},{text:cap(ls)+(generic.length>1?' demandent encore davantage de contrôle ou de précision':' demande encore davantage de contrôle ou de précision'),family:'controle'}]):st.pick('fabIII',[{text:'Des difficultés plus marquées concernent '+ls,family:'difficultes'},{text:cap(ls)+(generic.length>1?' nécessitent un accompagnement plus soutenu':' nécessite un accompagnement plus soutenu'),family:'accompagnement'},{text:'Une méthode plus structurée reste nécessaire pour '+ls,family:'methode'}]))}a.push(...detailed)}if(groups.NE.length)a.push('Les éléments non évalués concernant '+join(groups.NE.map(r=>META[r.key][0]),st,'fabNE')+' restent hors interprétation');return para(a)}
function briques(rows,id,st){const a=rows['briques-identification'],b=rows['briques-manipulation'];if(!a.level&&!b.level)return'';if(a.level==='I'&&b.level==='I')return para([st.pick('brI',[{text:'Dans la construction à base de briques, le schéma est compris et l’assemblage est correctement réalisé',family:'correctement'},{text:'La lecture du schéma ainsi que la manipulation des briques constituent des points d’appui',family:'support'},{text:'La construction à base de briques est menée de manière satisfaisante, tant dans la lecture du schéma que dans l’assemblage',family:'satisfaisant'},{text:'L’activité de briques ne fait pas apparaître de difficulté particulière dans les deux composantes évaluées',family:'absence-difficulte'}])]);const ss=[st.pick('brOpen',['La construction à base de briques apporte un éclairage complémentaire sur les capacités visuo-spatiales','Les deux composantes de la construction à base de briques sont appréciées séparément','La lecture du schéma et l’assemblage des briques apportent des informations complémentaires'])],assessed=[a,b].filter(r=>r.level);let previous=null;for(const r of assessed){const d=specific(r.key,r,id,st);let p=d[0]||phraseFor(r,st,'br:'+r.key);if(previous){const kind=tone(previous.level)!==tone(r.level)?'contrast':'addition';p=st.connector(kind)+', '+lower(p)}ss.push(p);previous=r}return para(ss)}
function organisation(rows,id,st){const rs=GROUPS.organisation.map(k=>rows[k]).filter(r=>r.level);if(!rs.length)return'';const a=[st.pick('orgOpen',['Les exercices de raisonnement, d’organisation et de planification permettent d’apprécier la manière dont plusieurs informations ou contraintes sont traitées','Les activités de raisonnement et d’organisation sollicitent la prise en compte de plusieurs contraintes','Le raisonnement, l’organisation et la planification sont observés à travers des situations comportant plusieurs contraintes','Les exercices d’organisation permettent d’examiner la manière dont les informations sont mises en relation et ordonnées'])];const ca=rows.carre,og=rows.organisation,pl=rows.planning,all=[ca,og,pl],assessed=all.filter(x=>['I','II','III'].includes(x.level));let previous=null,index=0;for(const r of assessed){const d=specific(r.key,r,id,st);let parts=d.length?d:[phraseFor(r,st,'org:'+r.key)];if(previous&&parts.length){const changed=tone(previous.level)!==tone(r.level),useConnector=changed||(index===1&&hash(st.seed+'|org-flow|'+r.key)%2===0);if(useConnector)parts[0]=st.connector(changed?'contrast':'addition')+', '+lower(parts[0])}a.push(...parts);previous=r;index++}const ne=all.filter(x=>x.level==='NE');if(ne.length===3)a.push('Les trois composantes de raisonnement, d’organisation et de planification n’ont pas pu être évaluées');else if(ne.length)a.push('Les éléments non évalués concernant '+join(ne.map(r=>META[r.key][0]),st,'org-ne')+' restent hors interprétation');if(pl.level==='I'&&['II','III'].includes(og.level))a.push(st.connector('contrast')+', la planification constitue un point d’appui alors que l’organisation de plusieurs critères demande davantage de repères');return para(a)}
function tri(rows,id,st){const t=rows['tri-temps'],e=rows['tri-erreurs'];if(!t.level&&!e.level)return'';const a=[];if(t.level==='I'&&e.level==='I')a.push(st.pick('triII',['Lors de l’activité de tri, le rythme de réalisation et la fiabilité sont satisfaisants','Le tri met en évidence un rythme adapté et une fiabilité conforme aux attentes','La tâche de tri est réalisée avec un rythme et un niveau de fiabilité satisfaisants']));else if(e.level==='I'&&['II','III'].includes(t.level))a.push('Le tri reste fiable, mais le rythme de réalisation est plus lent');else if(t.level==='I'&&['II','III'].includes(e.level))a.push('Le rythme du tri est adapté, tandis que la fiabilité demande davantage de contrôle');else{if(t.level)a.push(phraseFor(t,st,'tri:t'));if(e.level)a.push(phraseFor(e,st,'tri:e'))}const m=metric(t.comment+' '+e.comment);if(m.time&&!(t.level==='I'&&e.level==='I'))a.push('Le temps moyen relevé est de '+m.time.m+' min '+String(m.time.s).padStart(2,'0')+' s');const rep=reported(t.comment,id)||reported(e.comment,id);if(rep)a.push(rep);return para(a)}
function numerique(rows,id,st){const t=rows.texte,m=rows.mail;if(!t.level&&!m.level)return'';if(t.level==='NE'&&m.level==='NE')return para(['Concernant les outils numériques, le traitement de texte et la messagerie électronique n’ont pas pu être évalués']);const a=[];if(t.level==='I'&&m.level==='I')a.push(st.pick('numI',[{text:'Concernant les outils numériques, le traitement de texte et la messagerie sont utilisés de manière autonome',family:'autonomie'},{text:'Dans les tâches numériques proposées, les fonctions demandées en traitement de texte et en messagerie sont correctement mobilisées',family:'correctement'},{text:'L’utilisation du traitement de texte et de la messagerie ne fait pas apparaître de difficulté particulière',family:'absence-difficulte'}]));else if(t.level==='III'&&m.level==='III')a.push(st.pick('numIII',[{text:'Concernant les outils numériques, des difficultés importantes sont relevées dans le traitement de texte comme dans la messagerie',family:'difficultes'},{text:'Le traitement de texte et la messagerie nécessitent encore un accompagnement important',family:'accompagnement'},{text:'Les deux outils numériques restent difficiles à utiliser de manière autonome',family:'autonomie'}]));else{const td=t.level?specific('texte',t,id,st):[],md=m.level?specific('mail',m,id,st):[];if(t.level)a.push('Concernant les outils numériques, '+lower((td[0]||phraseFor(t,st,'num:t')).replace(/[.]$/,'')));if(m.level){const phrase=md[0]||phraseFor(m,st,'num:m');const gap=Math.abs(tone(t.level)-tone(m.level)),kind=(t.level==='NE'||m.level==='NE')?'addition':(gap>=2?'contrast':(gap===1?'softContrast':'addition'));a.push((a.length?st.connector(kind)+', ':'')+lower(phrase))}}return para(a)}
function fondamentaux(rows,id,st){const ex=rows.expression,me=rows['math-enonce'],mp=rows['math-problemes'];if(!ex.level&&!me.level&&!mp.level)return'';const a=[],exm=metric(ex.comment),mem=metric(me.comment),mpm=metric(mp.comment);if(ex.level){const details=specific('expression',ex,id,st);if(details.length)a.push(...details);else if(ex.level==='I')a.push(st.pick('exI',[{text:'En expression écrite, les compétences mobilisées sont satisfaisantes',family:'satisfaisant'},{text:'L’expression écrite constitue un point d’appui dans les exercices proposés',family:'support'}]));else if(ex.level==='II')a.push(st.pick('exII',[{text:'En expression écrite, certains acquis sont présents mais restent à consolider',family:'consolider'},{text:'La production écrite est globalement accessible, avec encore quelques points à renforcer',family:'renforcer'}]));else if(ex.level==='III')a.push(st.pick('exIII',[{text:'En expression écrite, des difficultés importantes restent présentes',family:'difficultes'},{text:'La production écrite nécessite encore un accompagnement soutenu',family:'accompagnement'}]));else a.push('L’expression écrite n’a pas pu être évaluée');if(exm.pct!=null){const pct=String(exm.pct).replace('.',',');if(ex.level==='II'&&details.length)a.push(withPct(st.connector('softContrast')+', certains points restent à consolider',pct,st,'expression'));else a.push(st.pick('exPct',[{text:'Le résultat global s’établit à '+pct+' % de réponses correctes',family:'resultat'},{text:'Le score relevé est de '+pct+' % de réponses correctes',family:'score'}]))}}if(me.level==='NE'&&mp.level==='NE')a.push('En mathématiques, la compréhension des consignes et la résolution de problèmes n’ont pas pu être évaluées');else if(me.level==='I'&&mp.level==='I'){const p1=mem.pct!=null?String(mem.pct).replace('.',','):null,p2=mpm.pct!=null?String(mpm.pct).replace('.',','):null;const first=p1?withPct(st.pick('math-consigne',[{text:'En mathématiques, la compréhension des consignes constitue un point d’appui',family:'support'},{text:'En mathématiques, les consignes sont comprises sans difficulté particulière',family:'absence-difficulte'},{text:'En mathématiques, la compréhension des consignes est correctement mobilisée',family:'correctement'}]),p1,st,'math-consigne-pct'):st.pick('math-consigne-no-pct',['En mathématiques, la compréhension des consignes constitue un point d’appui','En mathématiques, les consignes sont correctement comprises']);const secondBase=st.pick('math-problemes',[{text:'La résolution de problèmes est également bien mobilisée',family:'support'},{text:'La résolution de problèmes est correctement réalisée',family:'correctement'},{text:'Les situations de résolution de problèmes sont traitées de manière satisfaisante',family:'satisfaisant'}]);const second=p2?withPct(secondBase,p2,st,'math-problemes-pct'):secondBase;a.push(first);a.push(second)}else{if(me.level){const md=specific('math-enonce',me,id,st);let q='En mathématiques, '+lower((md[0]||phraseFor(me,st,'fund:me')).replace(/[.]$/,''));if(mem.pct!=null)q=withPct(q,String(mem.pct).replace('.',','),st,'fund:me-pct');a.push(q)}if(mp.level){const pd=specific('math-problemes',mp,id,st);let q=pd[0]||phraseFor(mp,st,'fund:mp');if(me.level){const changed=tone(me.level)!==tone(mp.level);q=st.connector(changed?'contrast':'addition')+', '+lower(q)}if(mpm.pct!=null)q=withPct(q.replace(/[.]$/,''),String(mpm.pct).replace('.',','),st,'fund:mp-pct');a.push(q)}}return para(a)}
function abandonSummary(records,st){const a=[];(records||[]).forEach((r,i)=>{const label=r.exercice||'un exercice',reasons=r.raisons||[],reasonText=reasons.join(' ; ');let line;if(reasonText){line=st.pick('abandon:'+i,[{text:'Pour '+label+', un abandon a été enregistré. Motif'+(reasons.length>1?'s':'')+' renseigné'+(reasons.length>1?'s':'')+' : '+reasonText,family:'abandon-motif'},{text:'L’exercice '+label+' a été interrompu. Motif'+(reasons.length>1?'s':'')+' indiqué'+(reasons.length>1?'s':'')+' : '+reasonText,family:'abandon-motif'},{text:'Concernant '+label+', l’abandon est associé au'+(reasons.length>1?'x motifs':' motif')+' suivant'+(reasons.length>1?'s':'')+' : '+reasonText,family:'abandon-motif'}])}else line='Pour '+label+', un abandon a été enregistré sans motif détaillé dans les données disponibles';if(r.commentaire&&norm(r.commentaire)!==norm(reasonText)){line=sent(line)+' Le commentaire renseigné précise : '+r.commentaire}a.push(line)});return para(a)}
function conclusion(rows,st){
 const labels={fabrication:'les activités de fabrication',briques:'la construction à base de briques',organisation:'le raisonnement, l’organisation et la planification',tri:'le tri',numerique:'les outils numériques',fondamentaux:'les savoirs fondamentaux'};
 const assessed=[];
 for(const [group,keys] of Object.entries(GROUPS)){
   const all=keys.map(k=>rows[k]),rs=all.filter(r=>['I','II','III'].includes(r.level)),ne=all.filter(r=>r.level==='NE').length;
   if(!rs.length&&!ne)continue;
   const ni=rs.filter(r=>r.level==='I').length,nii=rs.filter(r=>r.level==='II').length,niii=rs.filter(r=>r.level==='III').length,total=rs.length;
   let status='unassessed';
   if(total){
     status='mixed';
     if(niii/total>=0.5||niii>=2)status='difficulty';
     else if(ni/total>=0.75&&niii===0)status='support';
     if(ne>0&&status==='support')status='mixed';
   }
   assessed.push({group,label:labels[group],status,ni,nii,niii,total,ne});
 }
 if(assessed.length<3)return'';
 const supports=assessed.filter(x=>x.status==='support').map(x=>x.label);
 const mixed=assessed.filter(x=>x.status==='mixed').map(x=>x.label);
 const difficult=assessed.filter(x=>x.status==='difficulty').map(x=>x.label);
 const incomplete=assessed.filter(x=>x.ne>0).map(x=>x.label);
 if(supports.length>=4&&!mixed.length&&!difficult.length&&!incomplete.length)return para([st.pick('conclusion-all-support',[
   {text:'Dans l’ensemble, les compétences évaluées sont correctement mobilisées dans les différents domaines du plateau technique',family:'conclusion-globale-positive'},
   {text:'Au terme du parcours, les différents domaines évalués font apparaître des acquis globalement bien installés',family:'conclusion-globale-positive'},
   {text:'L’ensemble des domaines évalués met en évidence des compétences mobilisées de manière satisfaisante',family:'conclusion-globale-positive'}
 ])]);
 if(difficult.length>=4&&!supports.length&&!mixed.length&&!incomplete.length)return para([st.pick('conclusion-all-difficulty',[
   {text:'Dans l’ensemble, les difficultés concernent plusieurs domaines évalués et nécessitent encore des repères réguliers',family:'conclusion-globale-difficulte'},
   {text:'Au terme du parcours, plusieurs domaines restent difficiles à mobiliser et demandent un accompagnement plus soutenu',family:'conclusion-globale-difficulte'},
   {text:'Les résultats mettent en évidence des difficultés étendues à plusieurs domaines du plateau technique',family:'conclusion-globale-difficulte'}
 ])]);
 const a=[];
 if(supports.length)a.push(st.pick('conclusion-support',[
   {text:'Dans l’ensemble, '+join(supports,st,'conclusion-support')+' '+(supports.length>1?'constituent des points d’appui':'constitue un point d’appui'),family:'conclusion-support'},
   {text:'Au terme du parcours, '+join(supports,st,'conclusion-support2')+' '+(supports.length>1?'apparaissent comme des domaines bien mobilisés':'apparaît comme un domaine bien mobilisé'),family:'conclusion-acquis'},
   {text:'Les acquis les plus nets concernent '+join(supports,st,'conclusion-support3'),family:'conclusion-acquis'}
 ]));
 if(mixed.length)a.push(st.pick('conclusion-mixed',[
   {text:cap(join(mixed,st,'conclusion-mixed'))+' présentent des résultats plus contrastés selon les situations',family:'conclusion-mixed'},
   {text:'Des acquis restent à consolider dans '+join(mixed,st,'conclusion-mixed2'),family:'conclusion-consolidation'},
   {text:'Les résultats sont plus nuancés concernant '+join(mixed,st,'conclusion-mixed3'),family:'conclusion-nuance'}
 ]));
 if(difficult.length)a.push(st.pick('conclusion-difficult',[
   {text:'Les difficultés les plus marquées concernent '+join(difficult,st,'conclusion-difficult'),family:'conclusion-difficulty'},
   {text:cap(join(difficult,st,'conclusion-difficult2'))+' restent les domaines demandant le plus de repères',family:'conclusion-reperes'},
   {text:'Les besoins d’accompagnement sont plus importants dans '+join(difficult,st,'conclusion-difficult3'),family:'conclusion-accompagnement'}
 ]));
 if(incomplete.length)a.push(st.pick('conclusion-incomplete',[
   {text:'Certaines composantes n’ont pas pu être évaluées dans '+join(incomplete,st,'conclusion-incomplete'),family:'conclusion-incomplete'},
   {text:'L’interprétation reste partielle pour '+join(incomplete,st,'conclusion-incomplete2')+', certaines composantes n’ayant pas été évaluées',family:'conclusion-incomplete'},
   {text:'Des éléments restent hors interprétation dans '+join(incomplete,st,'conclusion-incomplete3')+', faute d’évaluation complète',family:'conclusion-incomplete'}
 ]));
 return para(a)
}
function validate(text,rows,abandons){const errors=[];if(!raw(text))errors.push('texte vide');if(/\bundefined\b|\bnull\b/.test(text))errors.push('valeur technique visible');if(/[ \t]{2,}/.test(text))errors.push('espaces multiples');for(const r of FORBIDDEN)if(r.test(text))errors.push('interprétation non autorisée');if(/En expression écrite,\s+l['’]expression écrite/i.test(text))errors.push('répétition du domaine expression écrite');if(/\bdemande encore une méthode plus structurée\b[\s\S]{0,180}\bdemande encore une méthode plus structurée\b/i.test(text))errors.push('structure répétée');if(/la découpe et le pliage et l['’]assemblage/i.test(text))errors.push('coordination et répétée');if(Object.values(rows).some(x=>x.level==='NE')&&!/(pas pu être évalu|hors interprétation|interromp|n’a pas été mené)/i.test(text))errors.push('NE non signalé');if(((abandons&&abandons.length)||Object.values(rows).some(x=>abandon(x.comment)))&&!/(abandon|interromp|hors interprétation|n’a pas été mené)/i.test(text))errors.push('abandon non signalé');if((text.match(/[^.!?]+[.!?]+/g)||[]).some(s=>s.length>250))errors.push('phrase trop longue');return{ok:!errors.length,errors}}
function generate(snapshot,options){snapshot=snapshot||{};const rows=rowsOf(snapshot),abandons=abandonsOf(snapshot),id=ident(snapshot.candidate),fingerprint=fp(snapshot,rows),st=new Styler(fingerprint+'|'+raw(options&&options.variant));const blocks=[intro(rows,id,st),fabrication(rows,id,st),briques(rows,id,st),organisation(rows,id,st),tri(rows,id,st),numerique(rows,id,st),fondamentaux(rows,id,st),abandonSummary(abandons,st),conclusion(rows,st)].filter(Boolean);let text=blocks.join('\n\n').replace(/[ \t]{2,}/g,' ').replace(/ +([,.])/g,'$1').replace(/\n{3,}/g,'\n\n').replace(/\b(et|mais|toutefois|cependant)\s+\1\b/gi,'$1').trim();if((abandons.length||Object.values(rows).some(r=>abandon(r.comment)))&&!/(abandon|interromp|hors interprétation|n’a pas été mené)/i.test(text))text+='\n\nUne activité a été interrompue au cours du parcours ; les éléments non réalisés restent hors interprétation.';const validation=validate(text,rows,abandons);return{ok:validation.ok,text,version:VERSION,fingerprint,validation,stats:{evaluated:Object.values(rows).filter(r=>['I','II','III'].includes(r.level)).length,nonEvaluated:Object.values(rows).filter(r=>r.level==='NE').length,abandoned:Math.max(abandons.length,Object.values(rows).filter(r=>abandon(r.comment)).length),paragraphs:text?text.split(/\n\s*\n/).length:0}}}
return{VERSION,META,GROUPS,VOCABULARY,generate,validateOutput:validate,normalizeLevel:level,parseMetrics:metric,_internals:{rowsOf,abandonsOf,ident,hash,Styler,reported,specific,join}};
});

/* ---- migrated final runtime block ---- */

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
