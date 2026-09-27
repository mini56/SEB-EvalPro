const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlFile = path.join(root, 'app', 'web', 'tri_de_cheville.html');
const moduleFile = path.join(root, 'app', 'web', 'js', 'tri-page.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro tri boutons: ' + message);
  process.exit(code);
}

if (!fs.existsSync(htmlFile)) fail('page tri_de_cheville.html introuvable');
if (!fs.existsSync(moduleFile)) fail('module tri-page.js introuvable');

const html = fs.readFileSync(htmlFile, 'utf8').replace(/\r\n/g, '\n');
const moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');

for (const token of [
  '<button id="startBtn" type="button">Démarrer le chronomètre</button>',
  '<button id="stopBtn" type="button" disabled>Arrêter le chronomètre</button>'
]) {
  if (!html.includes(token)) fail('bouton chrono attendu absent: ' + token, 3);
}
if (html.includes('id="resetBtn"')) fail('troisième bouton chrono réintroduit', 4);

for (const token of [
  'start.disabled = isRunning() || awaitingError !== null || currentTri > MAX_TRIS;',
  'stop.disabled = !isRunning();',
  'if (awaitingError !== null)',
  'chronoSeconds = 0;',
  "sessionStorage.setItem(LIVE_KEY, '0');",
  'errorInput.focus();'
]) {
  if (!moduleText.includes(token)) fail('état boutons chrono incomplet: ' + token, 5);
}

console.log('SEB EvalPro tri boutons: 2 boutons uniquement, arrêt -> erreurs, remise à zéro après saisie — OK.');
