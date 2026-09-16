const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const adminFile=path.join(root,'app','web','admin-bilan.html');
const historyFile=path.join(root,'src','bilan-history-preload.js');
function fail(m){console.error('SEB EvalPro 165+ dernier test sans IA V8: '+m);process.exit(2)}
function read(f){if(!fs.existsSync(f))fail('fichier introuvable: '+path.relative(root,f));return fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')}
function write(f,s){fs.writeFileSync(f,s,'utf8')}
function checkHtml(h){const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(h))){if(/\bsrc\s*=/.test(m[1]||''))continue;const c=String(m[2]||'').trim();if(c)try{new vm.Script(c)}catch(e){fail('JS inline invalide: '+e.message)}}}

const polish=String.raw`
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
`;

// Autocontrôle de la fusion sur les défauts observés lors du test #21.
{
 const box={};new vm.Script(polish+'\nthis.p=sebV8Polish;').runInNewContext(box);
 const sample=`Dans les activités de fabrication, plusieurs acquis sont bien installés. La lecture et la compréhension du plan, le traçage et le repérage, le pliage et l’assemblage et les finitions constituent des points d’appui dans la réalisation. La découpe demande encore davantage de contrôle et de précision. L’entrée dans l’exercice se fait sans aide. Les traits sont droits, le traçage est conforme aux spécificités du plan.\n\nLes exercices de raisonnement, d’organisation et de planification permettent d’apprécier la manière dont la personne traite plusieurs informations ou contraintes. La résolution d’un problème structuré reste difficile et nécessite une méthode plus explicite. L’organisation de plusieurs informations constitue un point de fragilité plus marqué. La planification constitue en revanche un point d’appui lorsque le cadre et les contraintes sont clairement identifiés. L’identification des contraintes et la mise en relation des éléments du problème restent difficiles. L’organisation de plusieurs critères génère encore de nombreuses erreurs et nécessite un accompagnement.\n\nConcernant les outils numériques, le traitement de texte constitue un point de difficulté et nécessite un accompagnement pour mobiliser les fonctions demandées. La messagerie électronique est globalement comprise, avec encore quelques vérifications utiles pour sécuriser les différentes étapes. Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché. L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.\n\nEn mathématiques, la compréhension des consignes et des énoncés constitue un point d’appui. La partie consacrée aux calculs et à la résolution de problèmes n’ayant pas été évaluée, aucune conclusion n’est formulée sur ce volet. La compréhension et l’exécution d’une consigne simple sont acquises.`;
 const out=box.p(sample);
 for(const bad of ['L’entrée dans l’exercice se fait sans aide.','Les traits sont droits, le traçage est conforme aux spécificités du plan.','Le traitement de texte n’est pas encore maîtrisé et nécessite un accompagnement rapproché.','L’envoi d’un message nécessite encore une aide, et certaines consignes peuvent être oubliées.','La compréhension et l’exécution d’une consigne simple sont acquises.'])if(out.includes(bad))fail('autocontrôle V8: répétition non fusionnée: '+bad);
 for(const good of ['La découpe reste moins maîtrisée','l’identification des contraintes et la mise en relation des éléments nécessitent une méthode plus explicite','la prise en compte de plusieurs critères génère encore de nombreuses erreurs','le traitement de texte reste difficile et nécessite un accompagnement rapproché','La messagerie électronique est mieux appréhendée','la compréhension et l’exécution d’une consigne simple constituent un point d’appui'])if(!out.includes(good))fail('autocontrôle V8: fusion attendue absente: '+good);
}

// Bilan courant : le moteur V7 reste intact, V8 polit uniquement le résultat généré.
{
 let h=read(adminFile);if(h.includes('seb-165plus-natural-synthesis-v8'))fail('V8 déjà injectée dans le bilan courant');if(!h.includes('seb-165plus-natural-synthesis-v7'))fail('V7 courante absente');
 const end=h.toLowerCase().lastIndexOf('</body>');if(end<0)fail('fin admin-bilan introuvable');
 const block=String.raw`\n<script id="seb-165plus-natural-synthesis-v8">(()=>{'use strict';\n${polish}\nwindow.sebV8Polish=sebV8Polish;\n})();</script>\n`;
 h=h.slice(0,end)+block+h.slice(end);
 const genOld='const value=sebV7Generate(l7,t7,sebV7Identity(c7()));';
 if(!h.includes(genOld))fail('génération courante V7 introuvable');
 h=h.replace(genOld,'const value=window.sebV8Polish(sebV7Generate(l7,t7,sebV7Identity(c7())));');
 checkHtml(h);write(adminFile,h);
}

// Anciens bilans : même polissage au moment de la régénération, sans modifier les synthèses déjà éditées manuellement.
{
 let s=read(historyFile);if(s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V8'))fail('V8 historique déjà injectée');if(!s.includes('SEB_HISTORY_NATURAL_SYNTHESIS_V7'))fail('V7 historique absente');
 const addon=String.raw`\n\n// SEB_HISTORY_NATURAL_SYNTHESIS_V8\n${polish}\n`;
 s+=addon;
 const old='return sebV7Generate(lv,tx,sebV7Identity(c||{}))';
 if(!s.includes(old))fail('générateur historique V7 introuvable');
 s=s.replace(old,'return sebV8Polish(sebV7Generate(lv,tx,sebV7Identity(c||{})))');
 try{new vm.Script(s)}catch(e){fail('historique V8 invalide: '+e.message)};write(historyFile,s);
}
console.log('SEB EvalPro 165+ V8: dernier polissage sans IA — observations fusionnées aux constats, répétitions supprimées, structure V7 conservée.');
