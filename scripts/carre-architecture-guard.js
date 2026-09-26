const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro garde carré: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/carre.html');
const page = read('app/web/js/carre-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html');

const protectedText = [
  '🏙️ Puzzle Gratte-ciel',
  "C'est la journée de cohésion d'équipe. Régulièrement, l'équipe est invitée à se retrouver pour partager un moment convivial.",
  "À cette occasion, la cheffe d'équipe a préparé un petit défi ! Elle propose à chacun une grille à compléter.",
  '📋 Règles du jeu',
  'Placez les chiffres <strong>1, 2, 3, 4</strong> dans chaque case',
  'Chaque chiffre doit apparaître <strong>une seule fois</strong> par ligne et par colonne',
  'Pour la rangée <strong>[2, 4, 3, 1]</strong>',
  'Cliquez sur <strong>"Valider"</strong> pour vérifier votre réponse',
  'Une fois terminé, cliquez sur <strong>"Page suivante"</strong>'
];
for (const token of protectedText) {
  if (!html.includes(token)) fail('contenu validé modifié: ' + token);
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/carre-page.js"></script>')) {
  fail('scripts modulaires Carré absents');
}
if (/onclick=["'][^"']*(?:validate|reset|goToNextPage)/i.test(html)) fail('ancien gestionnaire Carré inline réintroduit');
if (/function\s+(?:validate|reset|goToNextPage)\s*\(/.test(html)) fail('ancien moteur Carré réintroduit dans HTML');

for (const token of [
  'window.sebCarre = api;',
  'SEB_CARRE_LOCK95',
  "sessionStorage.setItem('puzzleErrors', String(errors));",
  "sessionStorage.setItem('carre_magique_score', String(score));",
  "sessionStorage.setItem('carre_magique_erreurs', String(errors));",
  "window.sebParcours.goNext('carre')",
  'Object.freeze([4, 3, 1, 2])',
  'Object.freeze([2, 4, 3, 1])',
  'Object.freeze([3, 1, 2, 4])',
  'Object.freeze([1, 2, 4, 3])'
]) {
  if (!page.includes(token)) fail('contrat Carré absent: ' + token);
}
if (/qcmv1\.0\.html/i.test(page)) fail('couplage direct Carré -> QCM réintroduit');

const carrePos = parcours.indexOf("id:'carre'");
const qcmPos = parcours.indexOf("id:'qcm-11'");
if (carrePos < 0 || qcmPos <= carrePos) fail('ordre Carré -> QCM page 11 absent');
for (const token of [
  "scoreStorage:'carre_magique_score'",
  "errorStorage:'carre_magique_erreurs'",
  "displayStorage:'puzzleErrors'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Carré absent du registre: ' + token);
}

for (const token of [
  "sessionStorage.getItem('puzzleErrors')",
  "sessionStorage.setItem('carre_magique_score', score)",
  "sessionStorage.setItem('carre_magique_erreurs', erreurs)",
  "sessionStorage.getItem('carre_magique_erreurs')"
]) {
  if (!qcm.includes(token)) fail('page Résultats/Bilan ne récupère plus Carré: ' + token);
}

console.log('SEB EvalPro garde carré: contenu, solution, score /16, verrouillage, Résultats et navigation centrale — OK.');
