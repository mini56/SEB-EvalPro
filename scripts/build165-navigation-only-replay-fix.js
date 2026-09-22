const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #165 Replay navigation-only: ' + message);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + relativePath, 3);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function checkJs(text, label) {
  try { new vm.Script(text); }
  catch (error) { fail(label + ' invalide: ' + error.message, 4); }
}

function removeListenerContaining(text, eventName, marker, label) {
  const markerAt = text.indexOf(marker);
  if (markerAt < 0) fail(label + ': marqueur introuvable: ' + marker, 5);
  const startNeedle = `  document.addEventListener('${eventName}'`;
  const listenerStart = text.lastIndexOf(startNeedle, markerAt);
  const listenerEnd = text.indexOf('  }, true);', markerAt);
  if (listenerStart < 0 || listenerEnd < 0 || listenerEnd <= markerAt) {
    fail(label + ': bornes du listener introuvables', 6);
  }
  const end = listenerEnd + '  }, true);'.length;
  return text.slice(0, listenerStart) + text.slice(end);
}

// -----------------------------------------------------------------------------
// Replay candidat : aucune capture pendant la saisie ou juste après l'affichage
// d'une page. Les données continuent d'être sauvegardées par preload.js.
// L'image Replay d'une page est prise uniquement avant une vraie navigation.
// Résultats conserve sa capture finale dédiée.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  const pageOpen = "  setTimeout(() => captureCurrentPage('page-open', true), 700);\n";
  if (!out.includes(pageOpen)) fail('capture page-open introuvable', 7);
  out = out.replace(pageOpen, '');

  out = removeListenerContaining(out, 'input', "scheduleCapture('input', 450)", 'capture input');
  out = removeListenerContaining(out, 'change', "scheduleCapture('change', 220)", 'capture change différée');

  const pageChange = "      scheduleCapture('page-change', 300);\n";
  if (!out.includes(pageChange)) fail('capture page-change introuvable', 8);
  out = out.replace(pageChange, '');

  for (const forbidden of [
    "captureCurrentPage('page-open'",
    "scheduleCapture('input'",
    "scheduleCapture('change'",
    "scheduleCapture('page-change'",
    "captureCurrentPage('before-action'",
    "scheduleCapture('after-action'"
  ]) {
    if (out.includes(forbidden)) fail('capture intermédiaire encore active: ' + forbidden, 9);
  }

  if (!out.includes("captureCurrentPage('final-results', true)")) {
    fail('capture finale Résultats absente', 10);
  }
  if (!out.includes('setTimeout(archiveIfFinalVisible, 380)')) {
    fail('surveillance archivage Résultats absente', 10);
  }

  checkJs(out, 'replay-preload.js');
  fs.writeFileSync(file, out, 'utf8');
}

// -----------------------------------------------------------------------------
// Second capteur Replay : supprimer la capture immédiate sur change. Le seul
// screenshot candidat restant ici est celui garanti juste avant navigation.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-navigation-capture.js');
  let out = text;

  out = removeListenerContaining(out, 'change', "captureNow('change-immediate')", 'capture change-immediate');

  for (const forbidden of [
    "captureNow('change-immediate')",
    "captureNow('focusout')"
  ]) {
    if (out.includes(forbidden)) fail('capture de saisie encore active: ' + forbidden, 11);
  }

  if (!out.includes("captureNow('navigation-before-guaranteed')") || !out.includes('await captureBeforeNavigation()') || !out.includes('NAV_CAPTURE_TIMEOUT_MS = 2000')) {
    fail('capture garantie bornée avant navigation absente', 12);
  }

  checkJs(out, 'replay-navigation-capture.js');
  fs.writeFileSync(file, out, 'utf8');
}

console.log('SEB EvalPro Build #165: Replay sans capture pendant la saisie; une capture garantie avant navigation + capture finale Résultats uniquement.');
