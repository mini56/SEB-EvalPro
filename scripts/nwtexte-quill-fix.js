const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'app', 'web');
const nwtextePath = path.join(webRoot, 'nwtexte.html');
const saveSimulationPath = path.join(webRoot, 'js', 'nwtexte-save-simulation.js');
const closedDialogsPath = path.join(webRoot, 'js', 'nwtexte-closed-dialogs.js');
const quillDist = path.join(root, 'node_modules', 'quill', 'dist');
const vendorDir = path.join(webRoot, 'vendor', 'quill');

function fail(message, code) {
  console.error(`SEB EvalPro nwtexte: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(nwtextePath)) fail('nwtexte.html introuvable.', 2);
if (!fs.existsSync(saveSimulationPath)) fail('simulation d’enregistrement nwtexte introuvable.', 3);
if (!fs.existsSync(closedDialogsPath)) fail('fenêtres fictives Ouvrir/Image nwtexte introuvables.', 8);
for (const name of ['quill.js', 'quill.core.css']) {
  if (!fs.existsSync(path.join(quillDist, name))) fail(`dépendance Quill manquante: ${name}`, 4);
}

fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(path.join(quillDist, 'quill.js'), path.join(vendorDir, 'quill.js'));
fs.copyFileSync(path.join(quillDist, 'quill.core.css'), path.join(vendorDir, 'quill.core.css'));

let html = fs.readFileSync(nwtextePath, 'utf8');
const beforeButtons = (html.match(/<button\b/gi) || []).length;
const beforeSelects = (html.match(/<select\b/gi) || []).length;

if (!html.includes('vendor/quill/quill.core.css')) {
  html = html.replace('</head>', `<link rel="stylesheet" href="vendor/quill/quill.core.css" id="seb-nwtexte-quill-core">\n<style id="seb-nwtexte-quill-visual-compat">\n#editor.ql-container{font-family:inherit;}\n#editor .ql-editor{padding:0;height:auto;min-height:100%;overflow:visible;font-family:Calibri,sans-serif;font-size:14px;line-height:normal;white-space:pre-wrap;}\n#editor .ql-editor p{margin:0;padding:0;}\n#editor .ql-editor img{max-width:320px;display:block;margin:6px 0;}\n</style>\n</head>`);
}

html = html.replace(
  '<div id="editor" contenteditable="true" spellcheck="true"></div>',
  '<div id="editor" spellcheck="true"></div>'
);

const realOpenControl = '<div><label style="cursor:pointer; display:block;">📂 Ouvrir<input type="file" id="openFile" accept=".txt,.html" style="display:none;" onchange="ouvrirFichier(this.files)"></label></div>';
const fakeOpenControl = '<div onclick="ouvrirFichierFictif(); toggleMenu(false)">📂 Ouvrir</div>';
if (!html.includes(realOpenControl)) fail('contrôle Ouvrir historique introuvable.', 9);
html = html.replace(realOpenControl, fakeOpenControl);

const realImageControl = '      <input type="file" accept="image/*" onchange="insererImage(this.files)" id="input-image" style="display:none;">\n      <button onclick="document.getElementById(\'input-image\').click()" title="Insérer une image">';
const fakeImageControl = '      <button onclick="ouvrirImageFictive()" title="Insérer une image">';
if (!html.includes(realImageControl)) fail('contrôle Image historique introuvable.', 10);
html = html.replace(realImageControl, fakeImageControl);

const legacyStart = html.indexOf("<script>\n(function () {\n  'use strict';");
const nextSimpleMarker = '<script>\nfunction nextSimple(){';
const legacyEnd = html.indexOf(nextSimpleMarker, legacyStart);
if (legacyStart < 0 || legacyEnd < 0) fail('bloc moteur historique introuvable.', 5);

const replacement = `<script src="vendor/quill/quill.js"></script>\n<script src="js/nwtexte-quill-engine.js"></script>\n<script src="js/nwtexte-save-simulation.js"></script>\n<script src="js/nwtexte-closed-dialogs.js"></script>\n\n`;
html = html.slice(0, legacyStart) + replacement + html.slice(legacyEnd);

const afterButtons = (html.match(/<button\b/gi) || []).length;
const afterSelects = (html.match(/<select\b/gi) || []).length;
if (beforeButtons !== afterButtons || beforeSelects !== afterSelects) {
  fail(`interface modifiée par erreur (boutons ${beforeButtons}->${afterButtons}, listes ${beforeSelects}->${afterSelects}).`, 6);
}

for (const required of [
  'onclick="format(\'bold\')"',
  'onchange="setFontSize(this.value)"',
  'onchange="changerInterligne(this.value)"',
  'onclick="nextSimple()"',
  'onclick="ouvrirFichierFictif(); toggleMenu(false)"',
  'onclick="ouvrirImageFictive()"',
  'js/nwtexte-quill-engine.js',
  'js/nwtexte-save-simulation.js',
  'js/nwtexte-closed-dialogs.js'
]) {
  if (!html.includes(required)) fail(`contrôle de structure absent: ${required}`, 7);
}

if (/type=["']file["']/i.test(html)) fail('un accès fichier Windows subsiste dans nwtexte.html.', 11);

fs.writeFileSync(nwtextePath, html, 'utf8');
console.log(`SEB EvalPro nwtexte: Quill 2 + simulations internes intégrés; aucun sélecteur de fichier Windows; interface conservée (${afterButtons} boutons, ${afterSelects} listes).`);
