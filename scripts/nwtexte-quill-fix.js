const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'app', 'web');
const nwtextePath = path.join(webRoot, 'nwtexte.html');
const quillDist = path.join(root, 'node_modules', 'quill', 'dist');
const vendorDir = path.join(webRoot, 'vendor', 'quill');

function fail(message, code) {
  console.error(`SEB EvalPro nwtexte: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(nwtextePath)) fail('nwtexte.html introuvable.', 2);
for (const name of ['quill.js', 'quill.core.css']) {
  if (!fs.existsSync(path.join(quillDist, name))) fail(`dépendance Quill manquante: ${name}`, 3);
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

const legacyStart = html.indexOf("<script>\n(function () {\n  'use strict';");
const nextSimpleMarker = '<script>\nfunction nextSimple(){';
const legacyEnd = html.indexOf(nextSimpleMarker, legacyStart);
if (legacyStart < 0 || legacyEnd < 0) fail('bloc moteur historique introuvable.', 4);

const replacement = `<script src="vendor/quill/quill.js"></script>\n<script src="js/nwtexte-quill-engine.js"></script>\n\n`;
html = html.slice(0, legacyStart) + replacement + html.slice(legacyEnd);

const afterButtons = (html.match(/<button\b/gi) || []).length;
const afterSelects = (html.match(/<select\b/gi) || []).length;
if (beforeButtons !== afterButtons || beforeSelects !== afterSelects) {
  fail(`interface modifiée par erreur (boutons ${beforeButtons}->${afterButtons}, listes ${beforeSelects}->${afterSelects}).`, 5);
}

for (const required of [
  'onclick="format(\'bold\')"',
  'onchange="setFontSize(this.value)"',
  'onchange="changerInterligne(this.value)"',
  'onclick="nextSimple()"',
  'js/nwtexte-quill-engine.js'
]) {
  if (!html.includes(required)) fail(`contrôle de structure absent: ${required}`, 6);
}

fs.writeFileSync(nwtextePath, html, 'utf8');
console.log(`SEB EvalPro nwtexte: Quill 2 intégré sans changement de barre d'outils (${afterButtons} boutons, ${afterSelects} listes).`);
