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
    if (result.fallback) { console.error('QWEN_REJECTED_SAMPLE\n'+String(result.rejectedSample||'')); throw new Error('Qwen a été refusé par le validateur: ' + (result.reason || 'raison inconnue')); }
    const text = String(result.text || '').trim();
    const norm = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!norm.startsWith('monsieur jose tout')) throw new Error('identité initiale incorrecte');
    if (/\b(il|elle)\b/i.test(text) || /\b(?:le candidat|la candidate|le stagiaire|la stagiaire|la personne)\b/i.test(text)) throw new Error('désignation personnelle interdite');
    if (/^\s*#{1,6}\s+|^\s*[-*]\s+/m.test(text)) throw new Error('titre ou liste détecté');
    if (/\d+(?:[.,]\d+)?\s*%|\d+\s*erreurs?\b|\bniveau\s*(?:I|II|III|NE)\b/i.test(text)) throw new Error('résultat brut récité');
    if (text.split(/\n\s*\n/).filter(Boolean).length < 4) throw new Error('moins de quatre paragraphes');
    for (const re of [/plan|decoup|assembl/, /raisonn|organis|planif|contrainte/, /tri|rythme|fiabil/, /traitement de texte|messager|numeriq/, /expression|math|calcul|consigne/]) {
      if (!re.test(norm)) throw new Error('domaine attendu absent: ' + re);
    }
    if (/\bprofil\b|\bdiagnostic\b|\bpsycholog|\borient(?:er|ation)\b|\bmetier\b/i.test(norm)) throw new Error('extrapolation interdite détectée');
    console.log('SEB IA profil JSON V10: OK - ' + (result.passes || 1) + ' passe(s), ' + Math.max(1, Math.round((result.elapsedMs || 0) / 1000)) + ' s.');
    console.log(text);
  } finally {
    service.stop();
  }
})().then(() => process.exit(0)).catch(error => {
  console.error(error.stack || error);
  process.exit(2);
});
