const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const adminFile=path.join(root,'app','web','admin-bilan.html');
const historyFile=path.join(root,'src','bilan-history-preload.js');
function fail(m){console.error('SEB EvalPro 165+ dernier test sans IA V9: '+m);process.exit(2)}
function read(f){if(!fs.existsSync(f))fail('fichier introuvable: '+path.relative(root,f));return fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')}
function write(f,s){fs.writeFileSync(f,s,'utf8')}
function checkHtml(h){const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(h))){if(/\bsrc\s*=/.test(m[1]||''))continue;const c=String(m[2]||'').trim();if(c)try{new vm.Script(c)}catch(e){fail('JS inline invalide: '+e.message)}}}

const polish=`
function sebV9Cap(s){s=String(s||'').trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s}
function sebV9Single(v){const s=String(v||'').replace(/\\r\\n/g,'\\n').trim();if(!s)return'';const out=[],seen=new Set;for(const p of s.split(/\\n\\s*\\n/).map(x=>x.replace(/\\s+/g,' ').trim()).filter(Boolean)){const k=p.toLocaleLowerCase('fr-FR');if(seen.has(k))continue;seen.add(k);out.push(p)}return out.join('\\n\\n')}
function sebV9BreakLongSentences(v){
 const paras=String(v||'').split(/\\n\\n+/);
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
 }).join('\\n\\n');
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
 s=s.replace(/\\b0\\s+erreurs\\b/gi,'0 erreur').replace(/\\b1\\s+erreurs\\b/gi,'1 erreur');
 s=s.replace(/[ \\t]{2,}/g,' ').replace(/ +\\n/g,'\\n').replace(/\\n{3,}/g,'\\n\\n').trim();
 return sebV9Single(s);
}
`;

// Autocontrôle avec le texte réel du test précédent.
{
 const box={};new vm.Script(polish+'\nthis.p=sebV9Style;').runInNewContext(box);
 const sample=`La personne a participé aux différentes mises en situation proposées au cours du plateau technique. Le parcours met en évidence des compétences mobilisables dans plusieurs domaines, mais aussi des difficultés qui limitent encore l’autonomie sur certaines tâches.\n\nDans les activités de fabrication, plusieurs acquis sont bien installés. La lecture et la compréhension du plan, le traçage et le repérage, le pliage, l’assemblage et les finitions constituent des points d’appui dans la réalisation. La découpe reste moins maîtrisée et demande encore davantage de contrôle et de précision.\n\nLes exercices de raisonnement, d’organisation et de planification permettent d’apprécier la manière dont la personne traite plusieurs informations ou contraintes. La résolution d’un problème structuré reste difficile : l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite. L’organisation de plusieurs informations constitue un point de fragilité plus marqué : la prise en compte de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement. La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés.\n\nEn expression écrite, les acquis sont présents, mais restent hétérogènes et demandent encore à être consolidés. L’orthographe en situation de dictée reste plus fragile.\n\nDans l’ensemble, les principaux points d’appui concernent les activités techniques de fabrication, la lecture de schéma et la manipulation, le rythme et la fiabilité dans le tri et la planification. Les besoins d’accompagnement se situent davantage dans le traitement de texte, le raisonnement, l’organisation de plusieurs informations et l’utilisation autonome de la messagerie.`;
 const out=box.p(sample);
 for(const bad of ['mais aussi des difficultés qui limitent encore l’autonomie','La lecture et la compréhension du plan, le traçage et le repérage','reste difficile : l’identification','point de fragilité plus marqué :','reste plus fragile','le rythme et la fiabilité dans le tri et la planification','l’organisation de plusieurs informations et l’utilisation autonome de la messagerie'])if(out.includes(bad))fail('autocontrôle V9: formulation lourde encore présente: '+bad);
 for(const good of ['Des difficultés persistent toutefois','La lecture du plan est bien maîtrisée.','L’identification des contraintes demande encore des repères.','Un accompagnement reste nécessaire dans ce type de situation.','L’orthographe en situation de dictée reste fragile.','L’utilisation autonome de la messagerie demande encore des repères.'])if(!out.includes(good))fail('autocontrôle V9: formulation attendue absente: '+good);
 const sentences=out.match(/[^.!?]+[.!?]+/g)||[];
 if(sentences.some(x=>x.trim().length>210))fail('autocontrôle V9: phrase encore trop longue');
 if(out.split(/\\n\\s*\\n/).filter(Boolean).length<4)fail('autocontrôle V9: paragraphes insuffisants');
}

// Bilan courant : V9 polit uniquement le texte produit par V8.
{
 let h=read(adminFile);if(h.includes('seb-165plus-natural-synthesis-v9'))fail('V9 déjà injectée dans le bilan courant');if(!h.includes('seb-165plus-natural-synthesis-v8'))fail('V8 courante absente');
 const end=h.toLowerCase().lastIndexOf('</body>');if(end<0)fail('fin admin-bilan introuvable');
 const block='\n<script id="seb-165plus-natural-synthesis-v9">(()=>{\'use strict\';\n'+polish+'\nwindow.sebV9Style=sebV9Style;\n})();</script>\n';
 h=h.slice(0,end)+block+h.slice(end);
 const old='const value=window.sebV8Polish(sebV7Generate(l7,t7,sebV7Identity(c7())));';
 if(!h.includes(old))fail('génération courante V8 introuvable');
 h=h.replace(old,'const value=window.sebV9Style(window.sebV8Polish(sebV7Generate(l7,t7,sebV7Identity(c7()))));');
 const wordOld='summaryHtml=summaryText?\'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap;line-height:1.35">\'+esc(summaryText)+\'</p>\':\'\'';
 const wordNew='summaryHtml=summaryText?\'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2>\'+summaryText.split(/\\n\\s*\\n/).map(p=>\'<p style="margin:0 0 9pt;line-height:1.35">\'+esc(p)+\'</p>\').join(\'\'):\'\'';
 if(!h.includes(wordOld))fail('export Word courant: bloc synthèse unique introuvable');
 h=h.replace(wordOld,wordNew);
 checkHtml(h);write(adminFile,h);
}

// Anciens bilans : même polissage lors d’une régénération. Les textes corrigés manuellement restent intacts.
{
 let s=read(historyFile);if(s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V9'))fail('V9 historique déjà injectée');if(!s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V8'))fail('V8 historique absente');
 s+='\n\n// SEB_HISTORY_NATURAL_SYNTHESIS_V9\n'+polish+'\n';
 const old='return sebV8Polish(sebV7Generate(lv,tx,sebV7Identity(c||{})))';
 if(!s.includes(old))fail('générateur historique V8 introuvable');
 s=s.replace(old,'return sebV9Style(sebV8Polish(sebV7Generate(lv,tx,sebV7Identity(c||{}))))');
 const histWordOld='const summaryHtml = edited.summary ? \'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2><p style="white-space:pre-wrap">\' + escapeHtml(edited.summary) + \'</p>\' : \'\';';
 const histWordNew='const summaryHtml = edited.summary ? \'<h2 style="margin-top:18pt">Synthèse de l’évaluation</h2>\' + edited.summary.split(/\\n\\s*\\n/).map(p => \'<p style="margin:0 0 9pt">\' + escapeHtml(p) + \'</p>\').join(\'\') : \'\';';
 if(!s.includes(histWordOld))fail('export Word historique: bloc synthèse unique introuvable');
 s=s.replace(histWordOld,histWordNew);
 try{new vm.Script(s)}catch(e){fail('historique V9 invalide: '+e.message)};write(historyFile,s);
}
console.log('SEB EvalPro 165+ V9: synthèse en paragraphes réels dans Word, erreurs 0/1 au singulier, structure professionnelle conservée.');
