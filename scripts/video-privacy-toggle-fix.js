const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'src', 'preload.js');

function fail(message) {
  console.error(`SEB EvalPro vidéo/confidentialité: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('src/preload.js introuvable');

let source = fs.readFileSync(target, 'utf8');
const oldLine = "toggle.style.setProperty('display', finalResults ? 'none' : 'block', 'important');";
const newLine = "toggle.style.setProperty('display', (finalResults || String(pageName() || '').toLowerCase() === 'introbrique.html') ? 'none' : 'block', 'important');";

if (!source.includes(oldLine) && !source.includes(newLine)) {
  fail('ligne de visibilité du bouton écran d’accueil introuvable');
}

if (source.includes(oldLine)) {
  source = source.replace(oldLine, newLine);
  fs.writeFileSync(target, source, 'utf8');
}

const finalSource = fs.readFileSync(target, 'utf8');
if (!finalSource.includes("String(pageName() || '').toLowerCase() === 'introbrique.html'")) {
  fail('garde vidéo absent après correction');
}

console.log('SEB EvalPro: bouton « Afficher l’écran d’accueil » masqué uniquement sur introbrique.html.');
