const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const admin=path.join(root,'app','web','admin-bilan.html');
const history=path.join(root,'src','bilan-history-preload.js');
const fail=m=>{console.error('SEB EvalPro 165+ V4: '+m);process.exit(2)};
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const write=(f,s)=>fs.writeFileSync(f,s,'utf8');
const ROWS=[
 ['fabrication-plan','la lecture et la compréhension d’un plan'],
 ['fabrication-tracage','le traçage et le repérage'],
 ['fabrication-decoupe','la découpe'],
 ['fabrication-assemblage','le pliage et l’assemblage'],
 ['fabrication-finition','la qualité des finitions'],
 ['briques-identification','la lecture et l’interprétation d’un schéma'],
 ['briques-manipulation','la manipulation et l’assemblage de pièces'],
 ['carre','le raisonnement visuo-spatial et la résolution d’un problème structuré'],
 ['organisation','l’organisation et la gestion logistique'],
 ['planning','la planification de tâches sous contraintes'],
 ['tri-temps','le rythme de réalisation du tri'],
 ['tri-erreurs','la fiabilité et le contrôle dans la tâche de tri'],
 ['texte','l’utilisation du traitement de texte'],
 ['mail','l’utilisation de la messagerie électronique'],
 ['expression','l’expression écrite'],
 ['math-enonce','la compréhension des consignes et énoncés mathématiques'],
 ['math-problemes','les calculs et la résolution de problèmes mathématiques']
];
const rowsSrc=JSON.stringify(ROWS);
const engine=String.raw`
const SEB_V4_ROWS=${rowsSrc};
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
`;

// Bilan courant
{
 let h=read(admin);
 if(h.includes('seb-v4-institutional-long-summary'))fail('V4 déjà injectée dans le bilan courant');
 const end=h.toLowerCase().lastIndexOf('</body>');if(end<0)fail('fin admin-bilan introuvable');
 const block=String.raw`
<style id="seb-v4-institutional-long-summary-style">
#seb-bilan-synthese-text{min-height:360px!important;line-height:1.45!important}
#seb-bilan-ressenti{margin:14px 0 4px;border:1px solid #b8cce4;background:#fbfdff;padding:14px}
#seb-bilan-ressenti h2{margin:0 0 8px;color:#1f4e79;font-size:15pt}
#seb-bilan-ressenti-text{width:100%;min-height:180px;box-sizing:border-box;padding:9px;font:11pt Calibri,Arial,sans-serif;line-height:1.4;resize:vertical}
</style>
<script id="seb-v4-institutional-long-summary">(()=>{'use strict';
${engine}
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
})();</script>
`;
 h=h.slice(0,end)+block+h.slice(end);
 const wordNeedle="+meta+t.outerHTML+summaryHtml+'</div></body></html>'";
 if(!h.includes(wordNeedle))fail('point Word courant introuvable');
 h=h.replace(wordNeedle,"+meta+t.outerHTML+summaryHtml+(String(sessionStorage.getItem('seb_evalpro_bilan_ressenti')||'').trim()?'<h2 style=\\\"margin-top:18pt\\\">'+esc(window.sebEvalProFeelingTitle?window.sebEvalProFeelingTitle():'Ressenti de la personne sur son plateau technique')+'</h2><p style=\\\"white-space:pre-wrap\\\">'+esc(String(sessionStorage.getItem('seb_evalpro_bilan_ressenti')||'').trim())+'</p>':'')+'</div></body></html>'");
 write(admin,h);
}

// Historique des bilans
{
 let s=read(history);
 if(s.includes('SEB_V4_HISTORY_LONG_SUMMARY'))fail('V4 déjà injectée dans historique');
 const marker='function openEditor(filename, archive) {';if(!s.includes(marker))fail('openEditor historique introuvable');
 const helper=String.raw`// SEB_V4_HISTORY_LONG_SUMMARY
${engine}
function sebV4HistorySummary(card,c){const tr=k=>[...card.querySelectorAll('tbody tr')].find(x=>x.dataset?.key===k&&!x.classList.contains('seb-bh-section')),l=k=>String(tr(k)?.querySelector('.seb-bh-level.on')?.dataset.level||''),t=k=>String(tr(k)?.querySelector('.seb-bh-comment')?.value||'');return sebV4Generate(l,t,sebV4Identity(c).lead)}
function sebV4HistoryFeelingTitle(c){return 'Ressenti de '+sebV4Identity(c).title+' sur son plateau technique'}
`;
 s=s.replace(marker,helper+'\n'+marker);
 const ret="return { title:'Bilan institutionnel', note:String(editor.dataset.note || ''), summary, headers:";
 if(!s.includes(ret))fail('document historique summary introuvable');
 s=s.replace(ret,"const feeling=String(editor.querySelector('#seb-bh-history-feeling')?.value||editor.dataset.feeling||'');\n  return { title:'Bilan institutionnel', note:String(editor.dataset.note || ''), summary, feeling, headers:");
 const cap="summary: String(window.sessionStorage.getItem('seb_evalpro_bilan_synthese') || ''),";
 if(!s.includes(cap))fail('capture historique summary introuvable');
 s=s.replace(cap,cap+"\n    feeling: String(window.sessionStorage.getItem('seb_evalpro_bilan_ressenti') || ''),");
 const ta='<textarea id="seb-bh-history-summary" style="width:100%;min-height:170px;box-sizing:border-box;padding:9px;font:14px Calibri,Arial"></textarea></section>';
 if(!s.includes(ta))fail('textarea synthèse historique introuvable');
 s=s.replace(ta,'<textarea id="seb-bh-history-summary" style="width:100%;min-height:360px;box-sizing:border-box;padding:9px;font:14px Calibri,Arial;line-height:1.45"></textarea></section><section style="margin:14px 0;border:1px solid #b8cce4;background:#fbfdff;padding:13px"><h2 id="seb-bh-history-feeling-title" style="margin:0 0 8px;color:#1f4e79"></h2><p style="font-size:12px;color:#555">Renseigner ici le bilan personnel exprimé par le stagiaire sur son parcours au plateau technique.</p><textarea id="seb-bh-history-feeling" style="width:100%;min-height:180px;box-sizing:border-box;padding:9px;font:14px Calibri,Arial;line-height:1.4"></textarea></section>');
 const gen="sa.value=sebBhSummary(card,candidate);card.dataset.summary=sa.value";
 if(!s.includes(gen))fail('générateur historique V3 introuvable');s=s.replace(gen,"sa.value=sebV4HistorySummary(card,candidate);card.dataset.summary=sa.value");
 const init="let currentFilename = filename;";if(!s.includes(init))fail('init historique introuvable');
 s=s.replace(init,"const fa=overlay.querySelector('#seb-bh-history-feeling');if(fa){fa.value=String((archive.document&&archive.document.feeling)||'');fa.addEventListener('input',()=>card.dataset.feeling=fa.value)}const ftitle=overlay.querySelector('#seb-bh-history-feeling-title');if(ftitle)ftitle.textContent=sebV4HistoryFeelingTitle(candidate);\n\n  "+init);
 const wh="const summaryHtml = edited.summary ? '<h2 style=\"margin-top:18pt\">Synthèse de l’évaluation</h2><p style=\"white-space:pre-wrap\">' + escapeHtml(edited.summary) + '</p>' : '';";
 if(!s.includes(wh))fail('Word historique summary introuvable');
 s=s.replace(wh,wh+"\n  const feelingHtml = edited.feeling ? '<h2 style=\\\"margin-top:18pt\\\">' + escapeHtml(sebV4HistoryFeelingTitle(candidate)) + '</h2><p style=\\\"white-space:pre-wrap\\\">' + escapeHtml(edited.feeling) + '</p>' : '';");
 const wend="table.outerHTML + summaryHtml + '</div></body></html>'";if(!s.includes(wend))fail('fin Word historique introuvable');s=s.replace(wend,"table.outerHTML + summaryHtml + feelingHtml + '</div></body></html>'");
 try{new vm.Script(s)}catch(e){fail('historique JS invalide: '+e.message)}
 write(history,s);
}
console.log('SEB EvalPro 165+ V4: synthèse institutionnelle 15-20 lignes + bloc Ressenti enregistré et exporté Word.');
