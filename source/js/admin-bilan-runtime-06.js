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
