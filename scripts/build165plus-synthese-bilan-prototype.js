const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const adminFile = path.join(root, 'app', 'web', 'admin-bilan.html');
const qcmFile = path.join(root, 'app', 'web', 'qcmv1.0.html');
const historyFile = path.join(root, 'src', 'bilan-history-preload.js');

function fail(message) {
  console.error('SEB EvalPro 165+ synthèse V2: ' + message);
  process.exit(2);
}
function read(file) {
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + path.relative(root, file));
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function checkInlineScripts(html, label) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/.test(m[1] || '')) continue;
    const code = String(m[2] || '').trim();
    if (!code) continue;
    try { new vm.Script(code); }
    catch (error) { fail(label + ': JavaScript inline invalide: ' + error.message); }
  }
}

// -----------------------------------------------------------------------------
// 1. Page 1 : civilité explicite. Aucun genre n'est déduit du prénom.
//    M. => il ; Mme => elle ; Autre => iel.
// -----------------------------------------------------------------------------
{
  let html = read(qcmFile);
  if (html.includes('id="civilite"')) fail('champ civilité déjà présent');

  const firstRow = `<label for="prénom">Prénom :</label>\n          <input class="step" type="text" id="prénom" name="prénom" autocomplete="given-name" required>`;
  if (!html.includes(firstRow)) fail('zone prénom page 1 introuvable');
  html = html.replace(firstRow, firstRow + `\n          <label for="civilite">Civilité :</label>\n          <select class="step" id="civilite" name="civilite" required style="min-width:115px;padding:4px">\n            <option value="">Choisissez</option>\n            <option value="M.">M.</option>\n            <option value="Mme">Mme</option>\n            <option value="Autre">Autre</option>\n          </select>`);

  const vars = `  const prénom = document.getElementById('prénom')?.value.trim() || '';\n  const lieu = document.getElementById('lieu')?.value.trim() || '';`;
  if (!html.includes(vars)) fail('variables candidat introuvables');
  html = html.replace(vars, `  const prénom = document.getElementById('prénom')?.value.trim() || '';\n  const civilite = document.getElementById('civilite')?.value || '';\n  if (!civilite) {\n    alert('Veuillez sélectionner une civilité.');\n    document.getElementById('civilite')?.focus();\n    return false;\n  }\n  const lieu = document.getElementById('lieu')?.value.trim() || '';`);

  const candidateSave = `    const candidatData = { nom, prénom, lieu, groupe, date };`;
  if (!html.includes(candidateSave)) fail('sauvegarde candidat_data introuvable');
  html = html.replace(candidateSave, `    const candidatData = { nom, prénom, civilite, lieu, groupe, date };`);

  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('</body> QCM introuvable');
  const restoreCivilite = String.raw`
<script id="seb-165plus-civilite-restore">
document.addEventListener('DOMContentLoaded',()=>{try{const c=JSON.parse(sessionStorage.getItem('candidat_data')||'{}');const s=document.getElementById('civilite');if(s&&['M.','Mme','Autre'].includes(String(c.civilite||'')))s.value=String(c.civilite)}catch(_){}});
</script>
`;
  html = html.slice(0, bodyEnd) + restoreCivilite + html.slice(bodyEnd);
  checkInlineScripts(html, 'qcmv1.0.html');
  write(qcmFile, html);
}

// -----------------------------------------------------------------------------
// 2. Historique : les nouveaux bilans conservent la civilité et la synthèse.
//    Les archives plus anciennes restent valides : absence de civilité =>
//    formulation neutre "La personne" dans le moteur de synthèse.
// -----------------------------------------------------------------------------
{
  let js = read(historyFile);
  const start = `function candidateFromPage() {\n  return {\n    nom: textOf(document.getElementById('nom')),\n    prenom: textOf(document.getElementById('prenom')),\n    date: textOf(document.getElementById('date')),\n    lieu: '',\n    groupe: ''\n  };\n}`;
  if (!js.includes(start)) fail('candidateFromPage historique introuvable');
  js = js.replace(start, `function candidateFromPage() {\n  let stored = {};\n  try { stored = JSON.parse(window.sessionStorage.getItem('candidat_data') || '{}') || {}; } catch (_) {}\n  return {\n    nom: textOf(document.getElementById('nom')),\n    prenom: textOf(document.getElementById('prenom')),\n    date: textOf(document.getElementById('date')),\n    civilite: ['M.','Mme','Autre'].includes(String(stored.civilite || '')) ? String(stored.civilite) : '',\n    lieu: '',\n    groupe: ''\n  };\n}`);

  const captureReturn = `    note: textOf(document.querySelector('.note')),\n    headers: headers.length ? headers : ['Modules', 'NE', 'I', 'II', 'III', 'Commentaires'],\n    rows\n  };`;
  if (!js.includes(captureReturn)) fail('capture bilan historique introuvable');
  js = js.replace(captureReturn, `    note: textOf(document.querySelector('.note')),\n    summary: String(window.sessionStorage.getItem('seb_evalpro_bilan_synthese') || ''),\n    headers: headers.length ? headers : ['Modules', 'NE', 'I', 'II', 'III', 'Commentaires'],\n    rows\n  };`);

  try { new vm.Script(js); } catch (error) { fail('bilan-history-preload.js invalide: ' + error.message); }
  write(historyFile, js);
}

// -----------------------------------------------------------------------------
// 3. Bilan courant : abandon institutionnel + moteur de synthèse V2.
//    Le moteur travaille par domaines et constats. Il ne transforme plus chaque
//    ligne du tableau en phrase et limite volontairement les énumérations.
// -----------------------------------------------------------------------------
{
  let html = read(adminFile);
  if (html.includes('seb-165plus-synthese-bilan-v2')) fail('prototype V2 déjà injecté');

  const end = html.toLowerCase().lastIndexOf('</body>');
  if (end < 0) fail('</body> admin-bilan introuvable');

  const block = String.raw`
<style id="seb-165plus-synthese-style-v2">
.seb-admin-abandon-section,.seb-admin-abandon-row{display:none!important}
#seb-bilan-synthese{margin:16px 0 4px;border:1px solid #9cc2e5;background:#f7fbff;padding:14px}
#seb-bilan-synthese h2{margin:0 0 5px;color:#1f4e79;font-size:16pt}
#seb-bilan-synthese .help{margin:0 0 10px;font-size:10pt;color:#444}
#seb-bilan-synthese .actions{display:flex;gap:8px;align-items:center;margin-bottom:9px}
#seb-bilan-synthese button{border:0;border-radius:5px;background:#0070c0;color:#fff;padding:8px 13px;font-weight:700;cursor:pointer}
#seb-bilan-synthese-text{width:100%;min-height:190px;padding:9px;font:11pt Calibri,Arial,sans-serif;line-height:1.4;resize:vertical;border:1px solid #888;background:#fff}
#seb-abandon-reference{margin-top:10px;padding:9px 11px;border-left:4px solid #ed7d31;background:#fff8ef;font-size:10pt;white-space:pre-line}
@media print{.seb-admin-abandon-section,.seb-admin-abandon-row,#seb-bilan-synthese .actions,#seb-abandon-reference,#seb-bilan-synthese .help{display:none!important}#seb-bilan-synthese{border:0;background:#fff;padding:0;margin-top:12px}#seb-bilan-synthese-text{border:0;resize:none;overflow:visible}}
</style>
<script id="seb-165plus-synthese-bilan-v2">
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
function install(){const table=document.getElementById('bilan');if(!table||document.getElementById('seb-bilan-synthese'))return;const sec=document.createElement('section');sec.id='seb-bilan-synthese';sec.innerHTML='<h2>Synthèse du bilan</h2><p class="help">Proposition automatique locale. Elle retient les constats principaux et reste entièrement modifiable par l’administrateur.</p><div class="actions"><button type="button" id="seb-generate-synthese">Générer / régénérer la synthèse</button><span id="seb-synthese-status"></span></div><textarea id="seb-bilan-synthese-text"></textarea><div id="seb-abandon-reference" hidden></div>';table.insertAdjacentElement('afterend',sec);const area=document.getElementById('seb-bilan-synthese-text');area.value=sessionStorage.getItem(S)||'';area.addEventListener('input',saveSummary);document.getElementById('seb-generate-synthese').addEventListener('click',()=>{area.value=generate();saveSummary();persist();document.getElementById('seb-synthese-status').textContent='Synthèse générée — vous pouvez la modifier.';reference()});document.getElementById('auto')?.addEventListener('click',()=>setTimeout(()=>{applyAbandons();persist();reference()},0));document.getElementById('save')?.addEventListener('click',()=>{saveSummary();applyAbandons();persist()});applyAbandons();persist();reference()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
</script>
`;
  html = html.slice(0, end) + block + html.slice(end);

  const clone = `function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);`;
  if (!html.includes(clone)) fail('fonction Word courant introuvable');
  html = html.replace(clone, clone + `t.querySelectorAll('.seb-admin-abandon-section,.seb-admin-abandon-row').forEach(x=>x.remove());`);

  const oldMeta = `const meta='<p><b>Nom :</b> '+esc(c.nom)+' &nbsp; <b>Prénom :</b> '+esc(c.prenom)+' &nbsp; <b>Date :</b> '+esc(c.date)+'</p>',h='<!doctype html><html><head><meta charset="utf-8">'+st+'</head><body><div class="Section1">'+meta+t.outerHTML+'</div></body></html>'`;
  if (!html.includes(oldMeta)) fail('point synthèse Word introuvable');
  const newMeta = `const meta='<p><b>Nom :</b> '+esc(c.nom)+' &nbsp; <b>Prénom :</b> '+esc(c.prenom)+' &nbsp; <b>Date :</b> '+esc(c.date)+'</p>',summaryText=String(sessionStorage.getItem('seb_evalpro_bilan_synthese')||'').trim(),summaryHtml=summaryText?'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap;line-height:1.35">'+esc(summaryText)+'</p>':'',h='<!doctype html><html><head><meta charset="utf-8">'+st+'</head><body><div class="Section1">'+meta+t.outerHTML+summaryHtml+'</div></body></html>'`;
  html = html.replace(oldMeta, newMeta);

  checkInlineScripts(html, 'admin-bilan.html');
  for (const token of [
    'seb-165plus-synthese-bilan-v2',
    'Exercice abandonné.',
    'Générer / régénérer la synthèse',
    "cv==='Autre'",
    "lead:'La personne'",
    'Les mathématiques demandent davantage de rigueur.',
    "summaryHtml=summaryText"
  ]) if (!html.includes(token)) fail('contrôle absent: ' + token);
  if (html.includes("Les résultats mettent en évidence des acquis satisfaisants concernant")) fail('ancien moteur ligne-par-ligne encore présent');

  write(adminFile, html);
}

console.log('SEB EvalPro 165+ Synthèse V2: civilité M./Mme/Autre; il/elle/iel; anciens bilans sans civilité => « La personne »; synthèse par grands constats avec phrases courtes; abandon institutionnel NE + commentaire contrôlé.');
