const assert = require('assert');
const { buildProfile } = require('../src/qwen-proposed-synthesis');
const { createLocalAiService } = require('../src/local-ai');

const rows = {
  'fabrication-plan': { level:'I', comment:"I. La personne n'a pas besoin d'aide pour commencer l'exercice." },
  'fabrication-tracage': { level:'I', comment:'I. Les traits sont droits, le traçage est conforme aux spécificités du plan.' },
  'fabrication-decoupe': { level:'II', comment:'II. Les découpes ne sont pas droites ou incomplètes.' },
  'fabrication-assemblage': { level:'I', comment:"I. La personne n'a pas besoin d'aide et l'assemblage est conforme." },
  'fabrication-finition': { level:'II', comment:"II. L’aspect du produit n'est pas conforme aux exigences, les opérations de finition ne sont pas effectuées avec précision." },
  'briques-identification': { level:'I', comment:"I. La personne n'a pas besoin d'aide pour commencer l'exercice." },
  'briques-manipulation': { level:'I', comment:'I. Assemble les pièces sans difficultés.', detail:'- 0 erreurs' },
  'carre': { level:'III', comment:"III. Est en difficultés pour identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.", detail:'- 7 erreurs' },
  'organisation': { level:'I', comment:"I. Est en capacité d'effectuer une tâche de gestion de stock multicritère de manière autonome sans erreur significative.", detail:'- 0 erreurs' },
  'planning': { level:'I', comment:"I. Est en capacité de déterminer l’ordre d’exécution de tâches les unes par rapport aux autres.", detail:'- 0 erreurs' },
  'tri-temps': { level:'I', comment:'Rythme satisfaisant.' },
  'tri-erreurs': { level:'I', comment:'Fiabilité satisfaisante.', detail:'3 erreurs' },
  'texte': { level:'I', comment:'I. La personne sait utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.', detail:'- 1 erreur' },
  'mail': { level:'I', comment:'I. Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus.', detail:'- 1 erreur' },
  'expression': { level:'I', comment:'I. Structure des phrases et orthographe grammaticale correct. Lexique approprié et précis avec des écrits /textes cohérent.', detail:'- 73 % de réponses correctes' },
  'math-enonce': { level:'I', comment:'I. Comprend et exécute une consigne unique.', detail:'- 100 % de réponses correctes' },
  'math-problemes': { level:'I', comment:'I. Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante.', detail:'- 93 % de réponses correctes' }
};

const profile = buildProfile({
  candidate:{ civilite:'M.', nom:'TOUT', prenom:'José', date:'22 septembre 2026' },
  rows
});

const expectedProfile = {
  identite:{
    civilite:'Monsieur',
    nom:'TOUT',
    prenom:'José',
    date_evaluation:'22 septembre 2026'
  },
  profil_global:'operationnel',
  points_appui:[
    {competence:'lecture de plans et compréhension de modèles',faits:'autonomie complète sur la structure 3D et la construction de briques',exercices_concernes:['structure 3D papier','briques']},
    {competence:'traçage et repérage',faits:'traits droits, conformité au plan',exercices_concernes:['structure 3D papier']},
    {competence:'pliage et assemblage',faits:'autonomie complète, assemblage conforme, zéro erreur sur les briques',exercices_concernes:['structure 3D papier','briques']},
    {competence:'gestion de stock multicritère',faits:'classement autonome sans erreur significative',exercices_concernes:['ranger le stock']},
    {competence:'planification de tâches sous contraintes',faits:"détermination de l'ordre d'exécution, zéro erreur",exercices_concernes:['le restaurant']},
    {competence:"rythme d'exécution sur tâche répétitive",faits:'rapidité remarquable, régularité, fiabilité satisfaisante',exercices_concernes:['tri de chevilles']},
    {competence:'outils numériques',faits:'production de travail présentable, messagerie hiérarchisée',exercices_concernes:['traitement de texte','messagerie']},
    {competence:'expression écrite',faits:'phrases structurées, orthographe correcte, textes cohérents',exercices_concernes:['expression écrite']},
    {competence:'mathématiques',faits:'compréhension totale des consignes, résolution de problèmes concrets',exercices_concernes:['mathématiques']}
  ],
  points_vigilance:[
    {competence:'opérations de découpe',faits:'découpes non droites ou incomplètes',exercices_concernes:['structure 3D papier']},
    {competence:'opérations de finition',faits:'aspect non conforme aux exigences, manque de précision',exercices_concernes:['structure 3D papier']},
    {competence:'résolution de problèmes structurés par contraintes',faits:'difficultés à identifier les contraintes et établir les relations entre éléments',exercices_concernes:['carré magique']}
  ],
  contrastes_observes:[
    {description:'capacités visuo-constructives',explication:'excellente lecture de plan et assemblage, mais découpe et finitions imprécises',exercices_concernes:['structure 3D papier']},
    {description:"organisation de l'information",explication:'planification réussie quand le cadre est clair, mais difficulté face à un problème abstrait sans cadre explicite',exercices_concernes:['le restaurant','carré magique']}
  ],
  liens_entre_exercices:[
    {exercices:['structure 3D papier','briques'],competence_commune:'capacités visuo-constructives et spatiales',constat:'résultats cohérents et positifs sur les deux exercices'},
    {exercices:['le restaurant','carré magique'],competence_commune:'traitement de contraintes',constat:'réussite quand les contraintes sont concrètes et contextualisées, difficulté quand elles sont abstraites'}
  ],
  faits_transversaux:[
    'participation active aux mises en situation',
    'ressenti du stagiaire à prendre en compte séparément'
  ]
};

assert.deepStrictEqual(profile, expectedProfile, 'Le JSON produit ne correspond pas au JSON de référence fourni par Qwen.');
console.log('QWEN_REFERENCE_JSON_MATCH: OK');

const payload = JSON.stringify({kind:'seb-qwen-proposition-directe-v1', profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(!result?.ok) throw new Error(result?.error||'Qwen direct: réponse vide');
    if(!String(result.text||'').trim()) throw new Error('Qwen direct: synthèse finale vide');
    console.log('QWEN_PROPOSED_PROFILE');
    console.log(JSON.stringify(profile,null,2));
    console.log('QWEN_RAW_BEGIN');
    console.log(String(result.rawText||result.text||''));
    console.log('QWEN_RAW_END');
    console.log('QWEN_POSTPROCESSED_BEGIN');
    console.log(String(result.text||''));
    console.log('QWEN_POSTPROCESSED_END');
    console.log('QWEN_VALIDATION_ERRORS '+JSON.stringify(result.validationErrors||[]));
  }finally{
    service.stop();
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e);process.exit(2)});
