const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'app', 'web');
const nwtextePath = path.join(webRoot, 'nwtexte.html');
const quillEnginePath = path.join(webRoot, 'js', 'nwtexte-quill-engine.js');
const pageControllerPath = path.join(webRoot, 'js', 'nwtexte-page.js');
const parcoursPath = path.join(webRoot, 'js', 'seb-parcours.js');
const quillDist = path.join(root, 'node_modules', 'quill', 'dist');
const vendorDir = path.join(webRoot, 'vendor', 'quill');

function fail(message, code = 2) {
  console.error('SEB EvalPro nwtexte architecture: ' + message);
  process.exit(code);
}

for (const file of [nwtextePath, quillEnginePath, pageControllerPath, parcoursPath]) {
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + path.relative(root, file));
}
for (const name of ['quill.js', 'quill.core.css']) {
  if (!fs.existsSync(path.join(quillDist, name))) fail('dépendance Quill manquante: ' + name, 3);
}
fs.mkdirSync(vendorDir, { recursive:true });
fs.copyFileSync(path.join(quillDist, 'quill.js'), path.join(vendorDir, 'quill.js'));
fs.copyFileSync(path.join(quillDist, 'quill.core.css'), path.join(vendorDir, 'quill.core.css'));

const html = fs.readFileSync(nwtextePath, 'utf8');
const engine = fs.readFileSync(quillEnginePath, 'utf8');
const page = fs.readFileSync(pageControllerPath, 'utf8');
const parcours = fs.readFileSync(parcoursPath, 'utf8');

for (const token of [
  'css/nwtexte.css',
  'vendor/quill/quill.core.css',
  'css/nwtexte-quill.css',
  'vendor/quill/quill.js',
  'js/seb-parcours.js',
  'js/nwtexte-quill-engine.js',
  'js/nwtexte-save-simulation.js',
  'js/nwtexte-closed-dialogs.js',
  'js/nwtexte-page.js',
  'id="nw-file-open"',
  'id="nw-image-button"',
  'id="nw-skip"',
  'id="btn-score"'
]) if (!html.includes(token)) fail('structure nwtexte absente: ' + token, 4);

for (const [regex,label] of [
  [/<script(?![^>]*\bsrc=)[^>]*>/i, 'script inline'],
  [/\son[a-z]+\s*=/i, 'gestionnaire inline'],
  [/contenteditable\s*=/i, 'contenteditable historique'],
  [/type=["']file["']/i, 'accès fichier Windows'],
  [/document\.execCommand/i, 'execCommand historique']
]) if (regex.test(html)) fail(label + ' encore présent dans nwtexte.html', 5);

for (const token of [
  'window.sebNwtexteEditor = editorApi',
  'scores.page7 = analyse.score.total;',
  'responses.page7_contenu_html = analyse.html;',
  'responses.page7_analyse = analyse;',
  'score.enregistrement'
]) if (!engine.includes(token)) fail('contrat moteur absent: ' + token, 6);

if (engine.includes('document.execCommand') || engine.includes('window.enregistrerFichier') ||
    engine.includes('window.ouvrirFichier') || engine.includes('window.insererImage')) {
  fail('ancienne API globale encore présente dans le moteur Quill', 7);
}
if (!page.includes("window.sebParcours.goNext('nwtexte')") || /nvmail\.html/i.test(page)) {
  fail('navigation nwtexte encore couplée directement à nvmail', 8);
}
if (!parcours.includes("{ id:'nwtexte', file:'nwtexte.html' }") ||
    !parcours.includes("{ id:'nvmail', file:'nvmail.html' }")) {
  fail('registre de parcours nwtexte -> nvmail incomplet', 9);
}

console.log('SEB EvalPro nwtexte: page pilote propre, moteur Quill unique, navigation centralisée — OK.');
