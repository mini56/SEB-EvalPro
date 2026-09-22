const { buildProfile, serialize, parsePayload } = require('../src/synthesis-profile');

const rows = {
  'fabrication-plan': { level: 'I', comment: "La personne n'a pas besoin d'aide pour commencer l'exercice." },
  'fabrication-tracage': { level: 'I', comment: 'Les traits sont droits, le traçage est conforme.' },
  'fabrication-decoupe': { level: 'II', comment: 'Les découpes demandent davantage de précision. - 2 erreurs' },
  'fabrication-assemblage': { level: 'I', comment: 'Assemblage conforme.' },
  'fabrication-finition': { level: 'II', comment: 'Les finitions demandent davantage de contrôle.' },
  'briques-identification': { level: 'I', comment: 'Comprend le schéma proposé.' },
  'briques-manipulation': { level: 'I', comment: 'Assemble sans difficulté. - 0 erreurs' },
  'carre': { level: 'III', comment: 'A des difficultés à identifier les contraintes et à établir les relations entre les éléments. - 7 erreurs' },
  'organisation': { level: 'I', comment: 'Réalise la tâche correctement. - 0 erreurs' },
  'planning': { level: 'I', comment: 'La planification est correcte. - 0 erreurs' },
  'tri-temps': { level: 'I', comment: 'Rythme satisfaisant.' },
  'tri-erreurs': { level: 'I', comment: 'Fiabilité satisfaisante.' },
  'texte': { level: 'I', comment: 'Utilise le traitement de texte pour produire un travail présentable. - 1 erreur' },
  'mail': { level: 'I', comment: 'La messagerie est maîtrisée dans les situations proposées. - 1 erreur' },
  'expression': { level: 'I', comment: '- 73 % de réponses correctes' },
  'math-enonce': { level: 'I', comment: '- 100 % de réponses correctes' },
  'math-problemes': { level: 'I', comment: '- 93 % de réponses correctes' }
};

const profile = buildProfile({ candidate: { civilite: 'M.', nom: 'José', prenom: 'tout' }, rows, abandons: [] });
const fallback = profile.fallback_text;
if (!fallback.startsWith('Monsieur JOSÉ Tout')) throw new Error('identité Monsieur/NOM/Prénom incorrecte');
if (/\b(?:il|elle|le candidat|le stagiaire)\b/i.test(fallback)) throw new Error('pronom interdit dans le fallback');
if (/\d+(?:[.,]\d+)?\s*%|\d+\s*erreurs?\b|\bniveau\s*(?:I|II|III|NE)\b/i.test(fallback)) throw new Error('résultat brut récité dans le fallback');
if (!profile.contrasts.some(x => x.id === 'contraintes-abstraites-concretes')) throw new Error('contraste abstrait/concret non détecté');
if (!profile.contrasts.some(x => x.id === 'fabrication-maitrise-precision')) throw new Error('contraste fabrication non détecté');
if (!profile.links.some(x => x.id === 'tri-rythme-fiabilite')) throw new Error('lien tri rythme/fiabilité non détecté');
if (profile.points_vigilance.some(x => /73|100|93/.test(JSON.stringify(x)))) throw new Error('scores bruts injectés dans les points de vigilance');
const payload = serialize(profile);
const parsed = parsePayload(payload);
if (!parsed || parsed.kind !== 'seb-evalpro-synthesis-profile-v1') throw new Error('payload JSON invalide');
if (!parsed.profile || parsed.profile.fallback_text) throw new Error('fallback ne doit pas être injecté dans le profil envoyé au modèle');
if (!String(parsed.fallback_text || '').includes('Monsieur JOSÉ Tout')) throw new Error('fallback payload absent');
console.log('SEB EvalPro synthesis profile V10 smoke: OK');
console.log(JSON.stringify({ identity: profile.identity, contrasts: profile.contrasts, links: profile.links }, null, 2));
