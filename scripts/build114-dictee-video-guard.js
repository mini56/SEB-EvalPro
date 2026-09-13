const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'app', 'web');

function fail(message) {
  console.error(`SEB EvalPro #114 garde dictée/vidéo: ${message}`);
  process.exit(2);
}

// 1) Parcours obligatoire : Genre/Nombres -> Dictée -> Tri de chevilles.
const genrePath = path.join(webRoot, 'genrenombres.html');
const dicteePath = path.join(webRoot, 'dictee.html');
if (!fs.existsSync(genrePath)) fail('genrenombres.html généré introuvable');
if (!fs.existsSync(dicteePath)) fail('dictee.html généré introuvable');

let genre = fs.readFileSync(genrePath, 'utf8');
if (!/dictee\.html/i.test(genre)) {
  let replacements = 0;
  genre = genre.replace(/window\.location\.href\s*=\s*(['"])tri_de_cheville\.html\1\s*;/gi, (match) => {
    replacements += 1;
    return "window.location.href = 'dictee.html';";
  });
  if (replacements !== 1) {
    fail(`redirection Genre/Nombres -> Tri inattendue (${replacements} occurrence(s) remplacée(s))`);
  }
  fs.writeFileSync(genrePath, genre, 'utf8');
}

const genreCheck = fs.readFileSync(genrePath, 'utf8');
if (!/window\.location\.href\s*=\s*['"]dictee\.html['"]/i.test(genreCheck)) {
  fail('Genre/Nombres ne redirige pas vers dictee.html après correction');
}

const dictee = fs.readFileSync(dicteePath, 'utf8');
if (!/tri_de_cheville\.html/i.test(dictee)) {
  fail('la dictée ne contient aucune redirection vers tri_de_cheville.html');
}

// 2) Le bouton global « Afficher l’écran d’accueil » doit rester masqué
// pendant introbrique.html. Le script confidentialité applique un style inline
// !important : il faut donc corriger sa logique, pas seulement le CSS de la page.
const preloadPath = path.join(root, 'src', 'preload.js');
if (!fs.existsSync(preloadPath)) fail('src/preload.js introuvable');

let preload = fs.readFileSync(preloadPath, 'utf8');
const oldLine = "toggle.style.setProperty('display', finalResults ? 'none' : 'block', 'important');";
const newLine = "toggle.style.setProperty('display', (String(pageName() || '').toLowerCase() === 'introbrique.html' || finalResults) ? 'none' : 'block', 'important');";

if (!preload.includes("=== 'introbrique.html'")) {
  if (!preload.includes(oldLine)) {
    fail('logique d’affichage du bouton accueil introuvable dans preload.js');
  }
  preload = preload.replace(oldLine, newLine);
  fs.writeFileSync(preloadPath, preload, 'utf8');
}

const preloadCheck = fs.readFileSync(preloadPath, 'utf8');
if (!preloadCheck.includes("=== 'introbrique.html'")) {
  fail('exclusion introbrique.html absente du bouton accueil');
}

console.log('SEB EvalPro #114: parcours Genre/Nombres -> Dictée -> Tri garanti; bouton accueil masqué pendant introbrique.html.');
