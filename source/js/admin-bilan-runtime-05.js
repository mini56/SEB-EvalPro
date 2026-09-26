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
