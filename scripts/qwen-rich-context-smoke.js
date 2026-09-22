const assert = require('assert');
const { buildRichProfile } = require('../src/qwen-rich-synthesis');
const { createLocalAiService } = require('../src/local-ai');

const rows = {
  'fabrication-plan': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice."},
  'fabrication-tracage': {level:'II',select:'II. Les traits sont droits mais pas aux dimensions indiquées.'},
  'fabrication-decoupe': {level:'I',select:'I. Les découpes sont conformes.'},
  'fabrication-assemblage': {level:'I',select:"I. La personne n'a pas besoin d'aide et l'assemblage est conforme."},
  'fabrication-finition': {level:'II',select:"II. L’aspect du produit n'est pas conforme aux exigences, les opérations de finition ne sont pas effectuées avec précision."},
  'briques-identification': {level:'I',select:"I. La personne n'a pas besoin d'aide pour commencer l'exercice.",detail:'- 1 erreur'},
  'briques-manipulation': {level:'I',select:'I. Assemble les pièces sans difficultés.',detail:'- 1 erreur'},
  'carre': {level:'III',select:"III. A des difficultés à identifier les contraintes d'un problème structuré et à établir les relations entre ses éléments.",detail:'- 10 erreurs'},
  'organisation': {level:'III',select:'III. Réalise la tâche avec de nombreuses erreurs nécessitant un accompagnement.',detail:'- 30 erreurs'},
  'planning': {level:'III',select:"III. N’est pas en capacité de déterminer l’ordre d’exécution de tâches les unes par rapport aux autres.",detail:'- 12 erreurs'},
  'tri-temps': {level:'I',comment:'Le rythme de réalisation est satisfaisant.',detail:'Moyenne 00:03'},
  'tri-erreurs': {level:'I',comment:'Fiabilité satisfaisante.',detail:'6 erreurs'},
  'texte': {level:'II',select:"II. A besoin d’aide pour utiliser un logiciel de traitement de texte pour produire un travail individuel présentable à un tiers.",detail:'- 4 erreurs'},
  'mail': {level:'I',select:'I. Est capable d’envoyer seule un message hiérarchisé par des codes et à deux destinataires convenus.',detail:'- 1 erreur'},
  'expression': {level:'II',comment:'Structure des phrases et orthographe globalement correcte. Idées présentées de manière ordonnée.',detail:'59 % de réussite'},
  'math-enonce': {level:'I',select:'I. Comprend et exécute une consigne unique.',detail:'100 % de réussite'},
  'math-problemes': {level:'I',select:'I. Est capable de calculer, mettre en œuvre des algorithmes et de traiter des problèmes de pourcentages et d’échelles liés à la vie courante.',detail:'93 % de réussite'}
};

const profile=buildRichProfile({
  candidate:{nom:'DURANT',prenom:'JEAN',date:'2026-09-19'},
  rows
});

assert(profile.domaines.length >= 4, 'Les grandes thématiques ne sont pas toutes présentes.');
assert(profile.points_appui.length > 0, 'Points d’appui absents.');
assert(profile.points_vigilance.length > 0, 'Points de vigilance absents.');
assert(profile.contrastes_observes.length > 0, 'Contrastes absents.');
assert.strictEqual(profile.faits_obligatoires.length,17,'Tous les faits évalués doivent être obligatoires.');
assert(profile.plan_couverture.filter(x=>x.obligatoire).length>=6,'Plan de couverture obligatoire incomplet.');
for(const id of ['carre','organisation','planning']){
  const fact=profile.faits_obligatoires.find(x=>x.id===id);
  assert(fact,'Fait obligatoire absent: '+id);
  assert.strictEqual(fact.importance,'prioritaire','La priorité forte est perdue pour '+id);
}

const qualitative=JSON.stringify({
  points_appui:profile.points_appui,
  points_vigilance:profile.points_vigilance,
  domaines:profile.domaines,
  contrastes_observes:profile.contrastes_observes,
  faits_obligatoires:profile.faits_obligatoires,
  plan_couverture:profile.plan_couverture
});
for(const forbidden of [
  /\b\d+(?:[.,]\d+)?\s*%/,
  /\b\d+\s*erreur(?:\(s\)|s)?\b/i,
  /\b\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\b/,
  /\b(?:niveau\s*)?(?:NE|III|II|I)\b/
]){
  assert(!forbidden.test(qualitative), 'Le JSON riche contient encore un élément quantitatif/niveau interdit: '+forbidden);
}

const payload=JSON.stringify({kind:'seb-qwen-rich-coverage-v2',profile});

(async()=>{
  const service=createLocalAiService({app:{isPackaged:false}});
  try{
    const result=await service.rewrite(payload);
    if(!result?.ok){
      console.error('QWEN_RICH_RAW_ON_FAILURE');
      console.error(String(result?.rawText||''));
      console.error('QWEN_RICH_ERRORS '+JSON.stringify(result?.validationErrors||[]));
      throw new Error(result?.error||'Qwen riche: réponse refusée');
    }
    const text=String(result.text||'').trim();
    assert(text,'Qwen riche: synthèse vide');
    const paragraphs=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
    assert(paragraphs.length>=6,'Qwen riche: moins de six paragraphes de couverture');
    console.log('QWEN_RICH_PROFILE_BEGIN');
    console.log(JSON.stringify(profile,null,2));
    console.log('QWEN_RICH_PROFILE_END');
    console.log('QWEN_RICH_OUTPUT_BEGIN');
    console.log(text);
    console.log('QWEN_RICH_OUTPUT_END');
    console.log('QWEN_RICH_COVERAGE_VALIDATION: OK');
  }finally{
    service.stop();
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e);process.exit(2)});
