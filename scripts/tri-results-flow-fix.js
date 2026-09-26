const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'app', 'web');
const triFile = path.join(web, 'tri_de_cheville.html');
const triModuleFile = path.join(web, 'js', 'tri-page.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro tri résultats: ' + message);
  process.exit(code);
}

if (!fs.existsSync(triFile)) fail('page tri_de_cheville.html introuvable');
if (!fs.existsSync(triModuleFile)) fail('module tri-page.js introuvable');

const html = fs.readFileSync(triFile, 'utf8').replace(/\r\n/g, '\n');
const moduleText = fs.readFileSync(triModuleFile, 'utf8').replace(/\r\n/g, '\n');

for (const token of [
  '<script src="js/tri-page.js"></script>',
  'Démarrer le chronomètre',
  'Arrêter le chronomètre',
  'Voir les résultats',
  'même s’il est égal à <strong>0</strong>',
  'Effectuez entre <strong>3 et 5 tris</strong>'
]) {
  if (!html.includes(token)) fail('contrat Tri modulaire absent: ' + token, 3);
}

if (html.includes('id="resetBtn"')) fail('ancien troisième bouton chrono encore présent', 4);
if (/onclick=["'][^"']*(?:startChrono|stopChrono|calcMoyenne|resetChrono)/i.test(html)) {
  fail('ancien gestionnaire chrono inline réintroduit', 5);
}

for (const token of [
  'const MIN_TRIS = 3;',
  'const MAX_TRIS = 5;',
  'function validErrorValue(raw)',
  'function completedTriIndexes()',
  'function stopChrono()',
  'awaitingError = currentTri;',
  'errorInput.focus();',
  "sessionStorage.setItem(DATA_KEY, JSON.stringify(data));",
  "sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));",
  'function showResults()',
  'function minimumTrisDone()',
  "window.sebEvalProShowTriResults = showResults;"
]) {
  if (!moduleText.includes(token)) fail('fonction Tri modulaire absente: ' + token, 6);
}

// QCM : conserver la visibilité institutionnelle des boutons calculatrice.
const qcmFile = path.join(web, 'qcmv1.0.html');
if (!fs.existsSync(qcmFile)) fail('page qcmv1.0.html introuvable', 7);
let qcm = fs.readFileSync(qcmFile, 'utf8').replace(/\r\n/g, '\n');
if (!qcm.includes('window.openCalculator()')) fail('boutons calculatrice introuvables dans le QCM', 8);
if (!qcm.includes('id="seb-calculator-button-style"')) {
  const calcStyle = `
<style id="seb-calculator-button-style">
button[onclick="window.openCalculator()"] {
  background-color: #F9B233;
  color: #1e293b;
  border: none;
  padding: 12px 25px;
  font-size: 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}
button[onclick="window.openCalculator()"]:hover {
  background-color: #e9a11f;
}
</style>
`;
  if (!qcm.includes('</head>')) fail('balise </head> du QCM introuvable', 9);
  qcm = qcm.replace('</head>', calcStyle + '</head>');
}
if (!qcm.includes('background-color: #F9B233')) fail('style orange clair de la calculatrice absent', 10);
fs.writeFileSync(qcmFile, qcm, 'utf8');

console.log('SEB EvalPro tri résultats: module 2 boutons, erreurs explicites, 3 à 5 tris et résultats différés — OK.');
