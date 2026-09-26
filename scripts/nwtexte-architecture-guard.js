const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro garde nwtexte: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/nwtexte.html');
const engine = read('app/web/js/nwtexte-quill-engine.js');
const page = read('app/web/js/nwtexte-page.js');
const save = read('app/web/js/nwtexte-save-simulation.js');
const dialogs = read('app/web/js/nwtexte-closed-dialogs.js');
const parcours = read('app/web/js/seb-parcours.js');
const result = read('app/web/qcmv1.0.html');
const bilan = read('app/web/admin-bilan.html');

const protectedText = [
  'Scénario :',
  "Répondez à l'une des trois questions suivantes dans un texte de dix lignes.",
  'Quelle est mon activité préférée et pourquoi ?',
  'Quelle est mon expérience professionnelle préférée et pourquoi ?',
  'Quel est mon métier préféré et pourquoi ?',
  "Préparez votre texte à la main si besoin, puis, quand vous êtes prêt, utilisez l'éditeur dans la fenêtre de droite.",
  "Dans l'éditeur, mettez en forme votre texte en respectant les consignes ci-dessous.",
  'Consigne :',
  '<strong>Titre :</strong> Notez la question choisie, puis mettez-la en <strong>gras</strong>, police <strong>Arial</strong>, taille <strong>16</strong>.',
  '<strong>Texte :</strong> Au moins <strong>10</strong> lignes. Police du corps de texte en <strong>Arial</strong>, taille <strong>12</strong>.',
  'Enregistrez le document dans le dossier <strong>SEB</strong> sur le bureau sous l\'intitulé :',
  '<strong>Nom*_Evaluation_Bureautique_SEB</strong>',
  "Ensuite, passez à l'étape suivante..."
];
for (const token of protectedText) if (!html.includes(token)) fail('contenu validé modifié: ' + token);

for (const [regex,label] of [
  [/<script(?![^>]*\bsrc=)[^>]*>/i, 'script inline'],
  [/\son[a-z]+\s*=/i, 'handler inline'],
  [/contenteditable\s*=/i, 'contenteditable historique'],
  [/type=["']file["']/i, 'sélecteur fichier Windows']
]) if (regex.test(html)) fail(label + ' réintroduit dans nwtexte');

for (const token of [
  'responses.page7_contenu_html = analyse.html;',
  'responses.page7_contenu_texte = analyse.texte;',
  'responses.page7_delta = quill.getContents();',
  'responses.page7_analyse = analyse;',
  'scores.page7 = analyse.score.total;',
  "sessionStorage.setItem('reponses_data'",
  "sessionStorage.setItem('scores_data'",
  'enregistrement: savedCorrectly ? 1 : 0'
]) if (!engine.includes(token)) fail('contrat résultats nwtexte altéré: ' + token);

if (!save.includes('window.sebNwtexteSave = Object.freeze')) fail('API sauvegarde nwtexte absente');
if (!dialogs.includes('window.sebNwtexteDialogs = Object.freeze')) fail('API fenêtres nwtexte absente');
if (!page.includes("window.sebParcours.goNext('nwtexte')")) fail('nwtexte ne passe pas par le registre parcours');
if (/nvmail\.html/i.test(page) || /nvmail\.html/i.test(html)) fail('couplage direct nwtexte -> nvmail réintroduit');

const nwPos=parcours.indexOf("id:'nwtexte'");
const mailPos=parcours.indexOf("id:'nvmail'");
if (nwPos<0||mailPos<=nwPos) fail('ordre parcours nwtexte -> nvmail absent');

// Résultats : compatibilité obligatoire avec les clés historiques du candidat.
for (const token of [
  "if (reponses['page7_analyse'])",
  "scores['page7']",
  'const scoreMax = 8;',
  'Enregistrement conforme'
]) if (!result.includes(token)) fail('page Résultats ne récupère plus nwtexte: ' + token);

if (!bilan.includes("Math.min(8,+sc.page7||0)")) fail('bilan Admin Traitement de texte /8 désynchronisé');

console.log('SEB EvalPro garde nwtexte: contenu, /8, résultats, APIs séparées et parcours central — OK.');
