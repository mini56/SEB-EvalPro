const assert = require('assert');
const { createLocalAiService } = require('../src/local-ai');

const source = [
  "Monsieur XX YY a participé aux mises en situation proposées au cours du plateau technique.",
  "Dans les activités de fabrication, la lecture du plan et le traçage sont réalisés sans besoin d'aide et conformément aux consignes. Les opérations de finition sont conformes et le travail est minutieux. La découpe reste toutefois irrégulière ou incomplète, et l'assemblage nécessite des consignes supplémentaires. La construction à base de briques est réalisée sans difficulté, tant pour la lecture du schéma que pour l'assemblage.",
  "Les exercices de raisonnement montrent une capacité à identifier les contraintes d'un problème structuré, à analyser leurs relations et à en déduire une solution. Le rangement du stock comporte de nombreuses erreurs nécessitant un accompagnement. À l'inverse, l'organisation des tâches dans l'exercice de planification est réalisée de manière adaptée. Le rythme et la fiabilité du tri de chevilles sont satisfaisants.",
  "L'utilisation du traitement de texte et de la messagerie est maîtrisée dans les situations proposées. L'expression écrite présente des phrases grammaticalement correctes, un lexique approprié et des textes cohérents. En mathématiques, les consignes simples sont comprises et les problèmes de pourcentages et d'échelles sont traités."
].join('\n\n');

const unsupportedConcepts = [
  'potentiel','stress','motivation','épanouissement','diagnostic',
  'orientation professionnelle','recommandation de formation','profil psychologique'
];

(async()=>{
  const service=createLocalAiService({app:{isPackaged:true}});
  try{
    const status=service.status();
    assert(status.available,'Pack IA installé mais non détecté par src/local-ai.js');
    const result=await service.rewrite(source);
    if(!result?.ok) throw new Error(result?.error||'Réécriture Ministral refusée');
    const text=String(result.text||'').trim();
    console.log('MINISTRAL_ADMIN_REWRITE_OUTPUT_BEGIN');
    console.log(text);
    console.log('MINISTRAL_ADMIN_REWRITE_OUTPUT_END');

    assert(text.startsWith("Monsieur XX YY a participé aux mises en situation proposées au cours du plateau technique."),
      'La première phrase institutionnelle doit rester exactement identique');
        assert(text.length>700,'Synthèse anormalement courte');
    assert(text.split(/\n\s*\n/).filter(Boolean).length>=3,'La synthèse doit rester structurée en paragraphes');

    const norm=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    for(const term of unsupportedConcepts){
      const n=term.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      assert(!norm.includes(n),'Concept absent de la source détecté: '+term);
    }

    assert(/decoup/.test(norm),'La découpe doit rester couverte');
    assert(/decoup[^.!?]{0,140}(?:irregul|incomplet|precision|droite|difficult)/.test(norm),
      'La vigilance sur la découpe doit rester une vigilance');
    assert(/assembl/.test(norm)&&/(?:consigne|aide|accompagnement|instruction)/.test(norm),
      'Le besoin de consignes sur l’assemblage doit être conservé');

    assert(/stock/.test(norm)&&/(?:erreur|accompagnement|difficult)/.test(norm),
      'La difficulté réelle de rangement du stock doit être conservée');
    assert(/planif|organisation des taches|ordre.*taches/.test(norm),
      'La réussite de planification doit être conservée');

    const planMatches=[...norm.matchAll(/(?:planif|organisation des taches|ordre[^.!?]{0,30}taches)[^.!?]*/g)].map(m=>m[0]);
    assert(planMatches.length>0,'La réussite de planification doit être couverte');
    for(const clause of planMatches){
      assert(!/(difficult|accompagnement|erreur|fragil)/.test(clause),
        'La planification positive ne doit pas être transformée en difficulté: '+clause);
    }

    const triMatches=[...norm.matchAll(/(?:tri de chevilles|rythme|fiabilite)[^.!?]*/g)].map(m=>m[0]);
    assert(triMatches.length>0,'Le tri doit être couvert');
    for(const clause of triMatches){
      assert(!/(difficult|accompagnement|amelior|fragil)/.test(clause),
        'Le tri satisfaisant ne doit pas être transformé en difficulté: '+clause);
    }

    // Le test ne juge jamais un choix de mot isolé. La fidélité sémantique
    // source ↔ synthèse est vérifiée par src/local-ai.js avec Mistral lui-même.
    assert(/traitement de texte/.test(norm),'Le traitement de texte doit être couvert');
    assert(/messagerie/.test(norm),'La messagerie doit être couverte');
    assert(/expression ecrite/.test(norm),'L’expression écrite doit être couverte');
    assert(/mathem/.test(norm),'Les mathématiques doivent être couvertes');

    console.log('MINISTRAL_ADMIN_REWRITE_XX: OK');
  } finally {
    service.stop();
  }
})().then(()=>process.exit(0)).catch(err=>{console.error(err.stack||err);process.exit(2);});
