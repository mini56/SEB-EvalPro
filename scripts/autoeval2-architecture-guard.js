const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro garde autoeval2: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/autoeval2.html');
const page = read('app/web/js/autoeval2-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html');

const protectedText = [
  'Autoévaluation personnelle',
  'Évaluez votre ressenti et votre progression pour la partie “Traitement de texte” et “Envoi d’e-mail”.',
  'Cochez les affirmations qui correspondent à votre expérience pendant cette activité.',
  'Utilisation du traitement de texte :',
  'Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments lors de cette activité.',
  'Je n’utilise jamais cet outil, c’est donc compliqué pour moi.',
  'Je n’ai pas de difficulté avec cet outil, c’est facile pour moi.',
  'Utilisation d’une boîte de messagerie :',
  'Laissez un commentaire pour préciser votre ressenti sur ces outils :',
  'Écrivez ici votre remarque libre...',
  'Valider mon autoévaluation'
];
for (const token of protectedText) if (!html.includes(token)) fail('contenu validé modifié: ' + token);

for (const value of ['stress','outilstexte','difficultetexte','stressmessage','outilsmessage','difficultemessage']) {
  if (!html.includes('value="' + value + '"')) fail('valeur autoévaluation absente: ' + value);
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/autoeval2-page.js"></script>')) fail('scripts modulaires autoeval2 absents');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('script inline autoeval2 réintroduit');
if (/\son[a-z]+\s*=/i.test(html)) fail('gestionnaire inline autoeval2 réintroduit');

for (const token of [
  "const STORAGE_KEY = 'autoEval2_resultats';",
  "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));",
  "window.sebParcours.goNext('autoeval2')",
  'window.sebAutoEval2 = api;',
  'function restoreEvaluation()'
]) if (!page.includes(token)) fail('contrat autoeval2 absent: ' + token);

if (/paronymes\.html/i.test(page)) fail('couplage direct autoeval2 -> paronymes réintroduit');

const autoPos=parcours.indexOf("id:'autoeval2'");
const parPos=parcours.indexOf("id:'paronymes'");
if(autoPos<0||parPos<=autoPos) fail('ordre autoeval2 -> paronymes absent');

for (const token of [
  'sessionStorage.getItem("autoEval2_resultats")',
  'const groupeTexte   = ["stress", "outilstexte", "difficultetexte"]',
  'const groupeMessage = ["stressmessage", "outilsmessage", "difficultemessage"]'
]) if (!qcm.includes(token)) fail('page Résultats ne récupère plus autoeval2: ' + token);

console.log('SEB EvalPro garde autoeval2: contenu, valeurs, reprise, Résultats et navigation centrale — OK.');
