const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');
const runtime = path.join(webDir, 'js', 'seb-ui-runtime.js');
const marker = 'seb-ui-runtime-loader';

function fail(message, code = 2) {
  console.error(`SEB EvalPro UI/abandon: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(webDir)) fail('dossier app/web introuvable');
if (!fs.existsSync(runtime)) fail('runtime js/seb-ui-runtime.js introuvable après préparation du web', 3);

const runtimeText = fs.readFileSync(runtime, 'utf8');
for (const required of ['seb_evalpro_abandons', 'Abandonner l’exercice', 'seb-action-btn', 'Exercices abandonnés par le stagiaire', 'seb-evalpro-abandon-admin-password', 'verifyAdminPassword', "'dictee.html'", "state.status = 'abandoned'", 'state.scoreSur20 = 0']) {
  if (!runtimeText.includes(required)) fail(`runtime incomplet : ${required}`, 4);
}

const pages = fs.readdirSync(webDir).filter((name) => /\.html?$/i.test(name));
if (pages.length < 10) fail(`nombre de pages HTML anormalement faible : ${pages.length}`, 5);

let patched = 0;
for (const name of pages) {
  const file = path.join(webDir, name);
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (html.includes(`id="${marker}"`)) continue;
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail(`balise </body> introuvable dans ${name}`, 6);
  const loader = `\n<script id="${marker}" src="js/seb-ui-runtime.js"></script>\n`;
  html = html.slice(0, bodyEnd) + loader + html.slice(bodyEnd);
  fs.writeFileSync(file, html, 'utf8');
  patched += 1;
}

for (const requiredPage of ['qcmv1.0.html', 'brique.html', 'tri_de_cheville.html', 'nwtexte.html', 'nvmail.html', 'admin-bilan.html']) {
  const file = path.join(webDir, requiredPage);
  if (!fs.existsSync(file)) fail(`page obligatoire introuvable : ${requiredPage}`, 7);
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(`id="${marker}"`)) fail(`runtime UI non injecté dans ${requiredPage}`, 8);
}

console.log(`SEB EvalPro UI/abandon: ${patched} page(s) équipées du style de boutons unifié et du mécanisme d’abandon avec motif + remontée administrateur.`);
