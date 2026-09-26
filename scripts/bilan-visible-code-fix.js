const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message) {
  console.error('SEB EvalPro QCM affichage: ' + message);
  process.exit(2);
}

function markerIsInsideScript(html, index) {
  const open = html.lastIndexOf('<script', index);
  const close = html.lastIndexOf('</script>', index);
  return open >= 0 && open > close;
}

if (!fs.existsSync(target)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(target, 'utf8');

const markerText = 'NOM DE FICHIER PERSONNALISÉ';
const runtimeTarget = path.join(root, 'app', 'web', 'js', 'qcm-runtime.js');
if (html.includes('js/qcm-runtime.js') && fs.existsSync(runtimeTarget)) {
  const runtime = fs.readFileSync(runtimeTarget, 'utf8').replace(/\r\n/g, '\n');
  if (!runtime.includes(markerText)) fail('bloc de nom de fichier Word introuvable dans qcm-runtime.js');
  for (const required of [
    'function exportToWord()',
    "let filename = 'Evaluation_SEB'",
    'filename = `Evaluation_${nomClean}_${prenomClean}`',
    "filename += '_' + new Date().toISOString().split('T')[0] + '.doc'",
    "const blob = new Blob(['\\ufeff', html]",
    'link.download = filename',
    'URL.revokeObjectURL(url)'
  ]) {
    if (!runtime.includes(required)) fail('export Word externe incomplet : ' + required);
  }
  console.log('SEB EvalPro QCM: code export Word externalisé et fonctionnel dans qcm-runtime.js.');
  process.exit(0);
}

let marker = html.indexOf(markerText);
if (marker < 0) fail('bloc de nom de fichier Word introuvable');

let repaired = false;

// Le bloc appartient à exportToWord(). S'il est sorti du <script>, cela signifie
// qu'une fermeture </script> a coupé la fonction avant sa fin. On retire uniquement
// cette fermeture prématurée; la fermeture normale située après la fonction reste en place.
if (!markerIsInsideScript(html, marker)) {
  const functionStart = html.lastIndexOf('function exportToWord()', marker);
  const prematureClose = html.lastIndexOf('</script>', marker);
  const scriptOpen = functionStart >= 0 ? html.lastIndexOf('<script', functionStart) : -1;
  const normalClose = html.indexOf('</script>', marker);

  if (functionStart < 0 || scriptOpen < 0 || prematureClose <= functionStart || normalClose < 0) {
    fail('structure exportToWord incohérente, réparation automatique refusée');
  }

  html = html.slice(0, prematureClose) + html.slice(prematureClose + '</script>'.length);
  repaired = true;
  marker = html.indexOf(markerText);
}

if (!markerIsInsideScript(html, marker)) {
  fail('bloc Word encore visible hors <script> après correction');
}

// Contrôles bloquants : le code doit rester fonctionnel et intégralement dans exportToWord.
const functionStart = html.lastIndexOf('function exportToWord()', marker);
const functionScriptOpen = html.lastIndexOf('<script', functionStart);
const functionScriptClose = html.indexOf('</script>', marker);
if (functionStart < 0 || functionScriptOpen < 0 || functionScriptClose < 0) {
  fail('fonction exportToWord non encadrée par un script valide');
}

const exportBlock = html.slice(functionStart, functionScriptClose);
for (const required of [
  "let filename = 'Evaluation_SEB'",
  'filename = `Evaluation_${nomClean}_${prenomClean}`',
  "filename += '_' + new Date().toISOString().split('T')[0] + '.doc'",
  "const blob = new Blob(['\\ufeff', html]",
  'link.download = filename',
  'URL.revokeObjectURL(url)'
]) {
  if (!exportBlock.includes(required)) fail('export Word incomplet : ' + required);
}

// Empêcher qu'une copie du même code soit rendue comme texte ailleurs dans le document.
let searchFrom = 0;
while (true) {
  const index = html.indexOf(markerText, searchFrom);
  if (index < 0) break;
  if (!markerIsInsideScript(html, index)) fail('copie visible du bloc Word détectée hors <script>');
  searchFrom = index + markerText.length;
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro QCM: code export Word invisible et fonctionnel; réparation fermeture prématurée=' + (repaired ? 'oui' : 'non') + '.');
