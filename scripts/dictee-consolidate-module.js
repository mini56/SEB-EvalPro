const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'dictee.html');
const controller = path.join(root, 'app', 'web', 'js', 'dictee-page.js');
const parcours = path.join(root, 'app', 'web', 'js', 'seb-parcours.js');

function fail(message) {
  console.error('SEB EvalPro consolidation Dictée: ' + message);
  process.exit(2);
}

if (!fs.existsSync(target)) fail('dictee.html généré introuvable');
if (!fs.existsSync(controller)) fail('dictee-page.js généré introuvable');
if (!fs.existsSync(parcours)) fail('seb-parcours.js généré introuvable');

const controllerText = fs.readFileSync(controller, 'utf8');
try { new vm.Script(controllerText); } catch (error) {
  fail('dictee-page.js invalide: ' + error.message);
}

let html = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');

for (const token of [
  'id="dicteeAudio"',
  'id="candidateText"',
  'id="verifyBtn"',
  'id="nextBtn"',
  'id="playBtn"',
  'id="pauseBtn"',
  'id="stopBtn"',
  'id="restartBtn"',
  'id="progress"',
  'id="seb-dictee-stable-style"',
  'dictee-reclamation-client.wav'
]) {
  if (!html.includes(token)) fail('structure finale historique absente avant consolidation: ' + token);
}

let removedInline = 0;
html = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>\s*/gi, (full, attrs) => {
  if (/\bsrc\s*=/i.test(attrs || '')) return full;
  removedInline += 1;
  return '';
});

if (removedInline < 6) fail('nombre inattendu de scripts inline Dictée retirés: ' + removedInline);

if (!html.includes('src="js/seb-ui-runtime.js"')) {
  html = html.replace(/<\/body>/i, '<script src="js/seb-ui-runtime.js"></script>\n</body>');
}
if (!html.includes('src="js/seb-parcours.js"')) {
  html = html.replace(/<\/body>/i, '<script src="js/seb-parcours.js"></script>\n</body>');
}
if (!html.includes('src="js/dictee-page.js"')) {
  html = html.replace(/<\/body>/i, '<script src="js/dictee-page.js"></script>\n</body>');
}

const inlineAfter = (html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) || []).length;
if (inlineAfter !== 0) fail('scripts inline encore présents après consolidation: ' + inlineAfter);
if (!html.includes('src="js/dictee-page.js"')) fail('contrôleur Dictée externe absent');
if (!html.includes('src="js/seb-parcours.js"')) fail('registre central absent de la Dictée');
if (!html.includes('src="js/seb-ui-runtime.js"')) fail('runtime abandon unifié absent de la Dictée');

for (const forbidden of [
  'id="seb-dictee-fixed-audio-ui-112"',
  'id="seb-dictee-moved-words-final"',
  'id="seb-dictee-complex-move-v3"',
  'id="seb-dictee-right-actions-final"',
  'id="seb-dictee-stable-runtime"'
]) {
  if (html.includes(forbidden)) fail('ancien runtime inline Dictée encore présent: ' + forbidden);
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro consolidation Dictée: ' + removedInline + ' scripts inline remplacés par dictee-page.js; visuel, WAV et style final conservés.');
