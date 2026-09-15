const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const adminFile=path.join(root,'app','web','admin-bilan.html');
const historyFile=path.join(root,'src','bilan-history-preload.js');
function fail(m){console.error('SEB EvalPro 165+ synthèse renforcée V6: '+m);process.exit(2)}
function read(f){if(!fs.existsSync(f))fail('fichier introuvable: '+path.relative(root,f));return fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')}
function write(f,s){fs.writeFileSync(f,s,'utf8')}
function checkHtml(h){const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(h))){if(/\bsrc\s*=/.test(m[1]||''))continue;const c=String(m[2]||'').trim();if(c)try{new vm.Script(c)}catch(e){fail('JS inline invalide: '+e.message)}}}

const engine=String.raw`
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
`;

{
 let h=read(adminFile);if(h.includes('seb-165plus-natural-synthesis-v6'))fail('V6 déjà injectée dans le bilan courant');if(!h.includes('seb-165plus-natural-synthesis-v5'))fail('V5 courante absente');const end=h.toLowerCase().lastIndexOf('</body>');if(end<0)fail('fin admin-bilan introuvable');
 const block=String.raw`
<script id="seb-165plus-natural-synthesis-v6">(()=>{'use strict';
${engine}
function c6(){try{return JSON.parse(sessionStorage.getItem('candidat_data')||'{}')||{}}catch(_){return{}}}
function r6(k){return document.querySelector('tr[data-r="'+k+'"]')}
function l6(k){const r=r6(k);return String(r?.dataset.level||r?.querySelector('.level.on')?.dataset.l||'')}
function t6(k){const r=r6(k);if(!r)return'';return [r.querySelector('.ctxt')?.value,r.querySelector('.detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')}
function install6(){const area=document.getElementById('seb-bilan-synthese-text'),old=document.getElementById('seb-generate-synthese');if(!area||!old)return;const cleaned=sebV6Dedupe(area.value);if(cleaned!==String(area.value||'').trim()){area.value=cleaned;sessionStorage.setItem('seb_evalpro_bilan_synthese',cleaned);area.dispatchEvent(new Event('input',{bubbles:true}))}const b=old.cloneNode(true);b.id='seb-generate-synthese';b.dataset.naturalV6='1';old.replaceWith(b);b.addEventListener('click',()=>{const value=sebV6Generate(l6,t6,sebV6Identity(c6()));area.value=value;sessionStorage.setItem('seb_evalpro_bilan_synthese',value);area.dispatchEvent(new Event('input',{bubbles:true}));const st=document.getElementById('seb-synthese-status');if(st)st.textContent='Synthèse renforcée à partir des niveaux et des commentaires — vous pouvez la modifier.'})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install6,100),{once:true});else setTimeout(install6,100);
})();</script>
`;
 h=h.slice(0,end)+block+h.slice(end);checkHtml(h);write(adminFile,h);
}

{
 let s=read(historyFile);if(s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V6'))fail('V6 historique déjà injectée');if(!s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V5'))fail('V5 historique absente');
 const addon=String.raw`

// SEB_HISTORY_NATURAL_SYNTHESIS_V6
${engine}
sebV4HistorySummary=function(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),lv=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),tx=k=>{const r=tr(k);if(!r)return'';return [r.querySelector('.seb-bh-comment')?.value,r.querySelector('.seb-bh-detail')?.textContent].map(x=>String(x||'').trim()).filter(Boolean).join(' ')};return sebV6Generate(lv,tx,sebV6Identity(c||{}))};
`;
 s+=addon;
 const loadNeedle="sa.value=String((archive.document&&archive.document.summary)||'');";if(s.includes(loadNeedle))s=s.replace(loadNeedle,"sa.value=sebV6Dedupe(String((archive.document&&archive.document.summary)||''));");
 const saveNeedle="const summary=String(editor.querySelector('#seb-bh-history-summary')?.value||editor.dataset.summary||'');";if(s.includes(saveNeedle))s=s.replace(saveNeedle,"const summary=sebV6Dedupe(String(editor.querySelector('#seb-bh-history-summary')?.value||editor.dataset.summary||''));");
 try{new vm.Script(s)}catch(e){fail('historique V6 invalide: '+e.message)}write(historyFile,s);
}
console.log('SEB EvalPro 165+ V6: synthèse renforcée par niveaux + commentaires, longueur non limitée à 20 lignes, déduplication stricte, bilan courant et historique.');
