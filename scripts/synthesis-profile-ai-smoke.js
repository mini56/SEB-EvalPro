const { createLocalAiService } = require('../src/local-ai');
const { buildProfile, serialize } = require('../src/synthesis-profile');

const rows = {
  'fabrication-plan': { level: 'I', comment: "La personne n'a pas besoin d'aide pour commencer l'exercice." },
  'fabrication-tracage': { level: 'I', comment: 'Le traçage est conforme.' },
  'fabrication-decoupe': { level: 'II', comment: 'Les découpes demandent davantage de précision.' },
  'fabrication-assemblage': { level: 'I', comment: 'Le pliage et l’assemblage sont maîtrisés.' },
  'fabrication-finition': { level: 'II', comment: 'Les finitions demandent davantage de contrôle.' },
  'briques-identification': { level: 'I', comment: 'La lecture du schéma est maîtrisée.' },
  'briques-manipulation': { level: 'I', comment: 'La manipulation et l’assemblage sont maîtrisés.' },
  'carre': { level: 'III', comment: 'Difficultés à identifier les contraintes et à établir les relations entre les éléments.' },
  'organisation': { level: 'I', comment: 'La tâche de rangement est correctement réalisée.' },
  'planning': { level: 'I', comment: 'La planification est correctement réalisée.' },
  'tri-temps': { level: 'I', comment: 'Rythme satisfaisant.' },
  'tri-erreurs': { level: 'I', comment: 'Fiabilité satisfaisante.' },
  'texte': { level: 'I', comment: 'Utilise le traitement de texte pour produire un travail présentable.' },
  'mail': { level: 'I', comment: 'La messagerie électronique est maîtrisée dans les situations proposées.' },
  'expression': { level: 'I', comment: 'Les compétences mobilisées en expression écrite sont satisfaisantes.' },
  'math-enonce': { level: 'I', comment: 'La compréhension des consignes constitue un point d’appui.' },
  'math-problemes': { level: 'I', comment: 'Les calculs et la résolution de problèmes sont satisfaisants.' }
};

const profile = buildProfile({ candidate: { civilite: 'M.', nom: 'José', prenom: 'tout' }, rows, abandons: [] });
const payload = serialize(profile);

(async () => {
  const service = createLocalAiService({ app: { isPackaged: false } });
  try {
    const result = await service.rewrite(payload);
    if (!result?.ok) throw new Error(result?.error || 'génération IA vide');
    const text = String(result.text || '').trim();
    if (!text) throw new Error('Qwen a produit une synthèse vide.');
    console.log('SEB IA profil JSON V10 — MODE OBSERVATION');
    console.log('Avertissements non bloquants: ' + JSON.stringify(result.warnings || []));
    console.log('QWEN_OUTPUT_BEGIN');
    console.log(text);
    console.log('QWEN_OUTPUT_END');
  } finally {
    service.stop();
  }
})().then(() => process.exit(0)).catch(error => {
  console.error(error.stack || error);
  process.exit(2);
});
