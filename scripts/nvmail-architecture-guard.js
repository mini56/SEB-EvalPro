const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro garde nvmail: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/nvmail.html');
const page = read('app/web/js/nvmail-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const results = read('app/web/qcmv1.0.html');

const protectedText = [
  'Votre conseiller vous contacte par e-mail pour vous prévenir que votre rendez-vous est déplacé.',
  'Il vous demande de lui envoyer votre rapport de stage en entreprise.',
  'conseil.perso@sauvegarde56.org',
  'stage-pro@sauvegarde56.org',
  'Mettez en objet : <strong>Prénom Mail-SEB</strong>',
  'Ajoutez votre <strong>rapport</strong> en pièce jointe.',
  'Prénom NOM',
  '01.02.34.56.78',
  "Ensuite, passez à l'étape suivante..."
];
for (const token of protectedText) if (!html.includes(token)) fail('contenu validé modifié: ' + token);

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/nvmail-page.js"></script>')) {
  fail('scripts modulaires nvmail absents');
}
if (/<form id="formEmail"[^>]*\sonsubmit=/i.test(html) ||
    /id="overlay"[^>]*\sonclick=/i.test(html) ||
    /data-seb-file=[^>]*\sonclick=/i.test(html) ||
    /id="nvmail-(?:skip|next)"[^>]*\sonclick=/i.test(html)) {
  fail('gestionnaire inline nvmail réintroduit');
}
if (/function\s+(?:evaluerFormulaire|saveEmailAnswers|signatureCandidatValide)\s*\(/.test(html)) {
  fail('moteur nvmail réintroduit dans le HTML');
}

for (const token of [
  'window.sebNvmail = api;',
  "String(to || '').trim() === 'conseil.perso@sauvegarde56.org'",
  "String(cc || '').trim() === 'stage-pro@sauvegarde56.org'",
  'function objetMailCandidatValide',
  'function telephoneMailValide',
  'function signatureCandidatValide',
  'page8_to: to',
  'page8_cc: cc',
  'page8_subject: subject',
  'page8_message: message',
  'page8_file: file',
  'score_total',
  "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));",
  "window.sebParcours.goNext('nvmail')"
]) if (!page.includes(token)) fail('contrat nvmail absent: ' + token);

if (/sessionStorage\.removeItem\(['"]page8_data['"]\)/.test(page)) fail('effacement page8_data interdit');
if (/autoeval2\.html/i.test(page)) fail('couplage direct nvmail -> autoeval2 réintroduit');

const nvPos=parcours.indexOf("id:'nvmail'");
const nextPos=parcours.indexOf("id:'autoeval2'");
if (nvPos<0||nextPos<=nvPos) fail('ordre nvmail -> autoeval2 absent');

for (const token of [
  "sessionStorage.getItem('page8_data')",
  'data.score_total || 0'
]) if (!results.includes(token)) fail('page Résultats ne récupère plus nvmail: ' + token);

console.log('SEB EvalPro garde nvmail: contenu, /6, page8_data, fonctions séparées et navigation centrale — OK.');
