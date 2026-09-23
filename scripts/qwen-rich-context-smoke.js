const assert = require('assert');
const { buildRichProfile } = require('../src/qwen-rich-synthesis');
const { createLocalAiService } = require('../src/local-ai');
const fs=require('fs'),path=require('path');

const bridge=fs.readFileSync(path.join(__dirname,'build-qwen-rich-context.js'),'utf8');
assert(bridge.includes("texte_loisir_optionnel:''"),'Le pont bilan doit laisser vide le champ personnel non présent dans SEB EvalPro.');

const rows = {
  'fabrication-plan': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'fabrication-tracage': {level:'I',select:'I. Les traits sont droits, le traçage est conforme aux spécificités du plan.'},
  'fabrication-decoupe': {level:'II',select:'II. Les découpes ne sont pas droites ou incomplètes.'},
  'fabrication-assemblage': {level:'II',select:'II. La personne demande des consignes supplémentaires pour assembler.'},
  'fabrication-finition': {level:'I',select:"I. L’aspect du produit est conforme aux exigences, le travail est minutieux."},
  'briques-identification': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'briques-manipulation': {level:'I',select:'I. Assemble les pièces sans difficultés.',detail:'- 1 erreur'},
  'carre': {level:'I',select:"I. Est en capacité d'identifier les contraintes d'un problème structuré, d'en analyser les relations et d'en déduire une solution.",detail:'- 0 erreurs'},
  'organisation': {level:'III',select:'III. Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.',detail:'- 30 erreurs'},
  'planning': {level:'I',select:"I. Est en capacité de déterminer l’ordre d’exécution de tâches les unes par rapport aux autres.",detail:'- 0 erreurs'},
  'tri-temps': {level:'I',comment:'Le rythme de réalisation est satisfaisant.',detail:'Moyenne 00:04'},
  'tri-erreurs': {level:'I',comment:'Fiabilité satisfaisante.',detail:'2 erreurs'},
  'texte': {level:'I',select:'I. La personne sait utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.',detail:'- 0 erreurs'},
  'mail': {level:'I',select:'I. Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus.',detail:'- 0 erreurs'},
  'expression': {level:'I',comment:'I. Structure des phrases et orthographe grammaticale correctes. Lexique approprié et précis avec des écrits/textes cohérents.',detail:'- 88 % de réponses correctes'},
  'math-enonce': {level:'I',select:'I. Comprend et exécute une consigne unique.',detail:'- 90 % de réponses correctes'},
  'math-problemes': {level:'I',select:'I. Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante.',detail:'- 89 % de réponses correctes'}
};

const profile=buildRichProfile({candidate:{civilite:'Monsieur',nom:'Garcia',prenom:'josé',date:'2026-09-22'},rows});
assert(profile.domaines_reussite.some(x=>/restaurant/i.test(x)),'La planification réussie doit être dans les réussites.');
assert(Array.isArray(profile.trame_factuelle)&&profile.trame_factuelle.length>=8,'La trame factuelle par domaines doit être construite.');
const domaine=n=>profile.trame_factuelle.find(x=>String(x.domaine).toLowerCase().includes(n));
assert(domaine('construction à base de briques').vigilances.length===0,'Les briques ne doivent contenir aucune vigilance.');
assert(domaine('carré magique').vigilances.length===0,'Le carré magique ne doit contenir aucune vigilance.');
assert(domaine('planification sous contraintes').vigilances.length===0,'La planification ne doit contenir aucune vigilance.');
assert(domaine('tri de chevilles').vigilances.length===0,'Le tri ne doit contenir aucune vigilance.');
assert(domaine('outils numériques').vigilances.length===0,'Les outils numériques ne doivent contenir aucune vigilance.');
assert(domaine('expression écrite').vigilances.length===0,'L’expression écrite ne doit contenir aucune vigilance.');
assert(domaine('mathématiques').vigilances.length===0,'Les mathématiques ne doivent contenir aucune vigilance.');
assert(domaine('fabrication d’une structure 3d').vigilances.length===2,'La fabrication doit conserver exactement les deux vigilances observées.');
assert(domaine('organisation logistique').vigilances.length===1,'La gestion logistique doit conserver sa vigilance.');
assert(profile.domaines_vigilance.some(x=>/organisation logistique/i.test(x)),'Le stock doit rester en vigilance.');
assert(!profile.domaines_vigilance.some(x=>/restaurant/i.test(x)),'La planification ne doit jamais être placée en vigilance.');
const contrast=profile.contrastes.join(' ');
assert(/organisation logistique/i.test(contrast),'Le contraste doit citer la difficulté réelle.');
assert(!/difficultés[^.]{0,120}planification/i.test(contrast),'Le contraste ne doit plus inventer une difficulté de planification.');

const payload=JSON.stringify({kind:'seb-qwen-rich-context-v1',profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(!result?.ok) throw new Error(result?.error||'Qwen direct: génération refusée');
    const text=String(result.text||'').trim();
    assert.strictEqual(result.guard,'qwen-factual-frame-v5','La trame factuelle v4 doit être active.');
    assert(text.startsWith('Monsieur GARCIA José a participé'),'Le début institutionnel doit être conservé.');
    assert(text.length>=700,'La synthèse ne doit pas être anormalement courte.');
    assert(text.split(/\n\s*\n/).filter(Boolean).length>=4,'La synthèse doit contenir au moins quatre paragraphes.');

    console.log('QWEN_LIGHT_FACTUAL_OUTPUT_BEGIN');
    console.log(text);
    console.log('QWEN_LIGHT_FACTUAL_OUTPUT_END');
    const norm=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    for(const unsupported of ['stress','blocage','potentiel','epanouissement','profil dynamique','adaptable','maximiser','performance optimale','motivation personnelle','volonte de','desir de progresser']){
      assert(!norm.includes(unsupported),'Interprétation non sourcée détectée: '+unsupported);
    }
    assert(!/\b(?:ce candidat|le candidat|le stagiaire|la personne)\b/.test(norm),'Désignation interdite de la personne évaluée.');
    assert(!/organisation logistique[^.!?]{0,160}(?:efficace|solide|maitris|autonom)/.test(norm),'La gestion logistique en vigilance ne doit pas être présentée comme une réussite.');
    assert(!/(?:potentiel professionnel|maximiser|performance|en train de progresser)/.test(norm),'Conclusion ou progression non sourcée détectée.');
    assert(!/\bil\s+(?:montre|maitrise|demontre|est capable|presente|rencontre|souffre|utilise|realise|a besoin|sait|comprend|assemble|reussit|dispose|possede)\b/.test(norm),'Pronom personnel "il" encore utilisé pour désigner le candidat.');
    const sentences=norm.split(/(?<=[.!?])\s+/);
    for(const [label,pattern] of [
      ['fabrication',/(fabrication|structure 3d|tracage|decoup|assembl|finition)/],
      ['briques',/(brique|schema simple)/],
      ['carré magique',/(carre magique|probleme structure)/],
      ['organisation logistique',/(organisation logistique|stock)/],
      ['planification',/(planif|ordre d.execution|restaurant)/],
      ['tri',/(tri de chevilles|fiabilite du tri|rythme de realisation)/],
      ['traitement de texte',/traitement de texte/],
      ['messagerie',/(messagerie|message hierarchise)/],
      ['expression écrite',/expression ecrite/],
      ['mathématiques',/mathematique/]
    ]){
      assert(pattern.test(norm),'Domaine obligatoire omis : '+label);
    }
    assert(/brique[^.!?]{0,220}(?:schema|compren|decoder|identifier)/.test(norm)||/schema simple/.test(norm),'La lecture/compréhension du schéma des briques doit être couverte.');
    assert(/assembl[^.!?]{0,180}(?:consigne|aide|etayage)/.test(norm),'La vigilance d’assemblage de la fabrication doit être couverte.');
    function noInventedDifficulty(labels,description){
      const related=sentences.filter(s=>labels.some(label=>s.includes(label)));
      for(const sentence of related){
        const check=sentence.replace(/sans difficult(?:e|es)?/g,'').replace(/aucune difficult(?:e|es)?/g,'');
        assert(!/(difficult|fragil|limite|a consolider|etayage|accompagnement|soutien|amelior|incomplet|insuffisant|souffr)/.test(check),
          description+' transformé en difficulté: '+sentence);
      }
    }
    noInventedDifficulty(['brique','schema simple'],'La construction à base de briques');
    noInventedDifficulty(['carre magique','probleme structure'],'Le carré magique');
    noInventedDifficulty(['planif','ordre d’execution','restaurant'],'La planification');
    noInventedDifficulty(['tri de chevilles','fiabilite du tri','rythme de realisation'],'Le tri');
    noInventedDifficulty(['traitement de texte'],'Le traitement de texte');
    noInventedDifficulty(['messagerie'],'La messagerie');
    noInventedDifficulty(['expression ecrite'],'L’expression écrite');
    noInventedDifficulty(['mathematique'],'Les mathématiques');
    const fabricationSentences=sentences.filter(s=>s.includes('fabrication')||s.includes('structure 3d')||s.includes('decoupe')||s.includes('assemblage'));
    assert(fabricationSentences.some(s=>/decoup/.test(s)&&/difficult|precision|etayage|incomplet|droite/.test(s)),'La vigilance réelle sur la découpe doit être conservée.');
    assert(fabricationSentences.some(s=>/assembl/.test(s)&&/consigne|etayage|aide/.test(s)),'La vigilance réelle sur l’assemblage doit être conservée.');
    assert(!fabricationSentences.some(s=>/maitrise avancee|maitrise complete|maitrise globale/.test(s)),
      'La fabrication mixte ne doit pas être généralisée comme une maîtrise globale.');
    const org=sentences.filter(s=>s.includes('organisation logistique')||s.includes('stock'));
    assert(org.some(s=>/difficult|accompagnement|etayage|erreur/.test(s)),'La difficulté réelle de gestion logistique doit être présente.');
    assert(!/monsieur convient de noter/.test(norm),'La tournure impersonnelle "Il convient" ne doit plus être cassée.');
    assert(!/qu['’]monsieur/.test(norm),'Le remplacement mécanique il/elle ne doit plus produire qu’Monsieur.');

    console.log('QWEN_LIGHT_FACTUAL_GARCIA: OK');

    const cancelStarted=Date.now();
    const pendingCancellation=service.rewrite(payload);
    await new Promise((resolve)=>setTimeout(resolve,25));
    const cancelResult=service.cancelCurrent('Fermeture du candidat — smoke test');
    assert(cancelResult && cancelResult.ok,'L’annulation IA doit répondre ok.');
    assert(cancelResult.cancelled,'L’annulation doit interrompre une requête ou arrêter Qwen.');
    const cancelledRewrite=await pendingCancellation;
    const cancelElapsed=Date.now()-cancelStarted;
    assert(cancelledRewrite && cancelledRewrite.ok===false,'La synthèse annulée ne doit jamais être validée.');
    assert(cancelElapsed<15000,'La synthèse annulée doit rendre la main rapidement.');
    console.log('QWEN_CANCEL_ON_CANDIDATE_CLOSE: OK '+cancelElapsed+'ms');
  }finally{
    service.stop();
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e);process.exit(2)});
