const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro cell click stability: ' + message);
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

// Un simple clic de focus dans un champ ne doit pas déclencher de capture plein écran.
// Les réponses restent capturées par input/change, et les vraies navigations par
// replay-navigation-capture.js avant de quitter la page.
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;
  const beforeMarker = "captureCurrentPage('before-action', true);";
  const markerAt = out.indexOf(beforeMarker);
  if (markerAt < 0) fail('capture before-action introuvable', 5);

  const listenerStart = out.lastIndexOf("  document.addEventListener('click', (event) => {", markerAt);
  const listenerEnd = out.indexOf("  }, true);", markerAt);
  if (listenerStart < 0 || listenerEnd < 0 || listenerEnd <= markerAt) fail('bornes du listener click Replay introuvables', 6);

  const clickBlock = out.slice(listenerStart, listenerEnd + "  }, true);".length);
  for (const expected of [
    "event.target.closest",
    "button,a,input,select,textarea,[contenteditable]",
    "captureCurrentPage('before-action', true)",
    "scheduleCapture('after-action', 320)"
  ]) {
    if (!clickBlock.includes(expected)) fail('listener click inattendu, contrôle absent: ' + expected, 7);
  }
  out = out.slice(0, listenerStart) + out.slice(listenerEnd + "  }, true);".length);

  if (out.includes(beforeMarker)) fail('capture before-action encore présente', 8);
  if (!out.includes("scheduleCapture('input', 450)")) fail('capture input absente', 9);
  if (!out.includes("scheduleCapture('change', 220)")) fail('capture change absente', 10);
  checkJs(out, 'replay-preload.js');
  fs.writeFileSync(file, out, 'utf8');
}

// Le focusout se produit précisément quand on clique dans une autre cellule.
// Il lançait une seconde capture plein écran ~70 ms après le clic. Le change
// immédiat suffit à conserver l'état saisi sans provoquer ce rendu parasite.
{
  const { file, text } = read('src/replay-navigation-capture.js');
  let out = text;
  const focusMarker = "captureNow('focusout')";
  const markerAt = out.indexOf(focusMarker);
  if (markerAt < 0) fail('capture focusout introuvable', 11);

  const listenerStart = out.lastIndexOf("  document.addEventListener('focusout'", markerAt);
  const listenerEnd = out.indexOf("  }, true);", markerAt);
  if (listenerStart < 0 || listenerEnd < 0 || listenerEnd <= markerAt) fail('bornes du listener focusout introuvables', 12);

  const focusBlock = out.slice(listenerStart, listenerEnd + "  }, true);".length);
  if (!focusBlock.includes("setTimeout(() => { captureNow('focusout'); }, 70)")) fail('listener focusout inattendu', 13);
  out = out.slice(0, listenerStart) + out.slice(listenerEnd + "  }, true);".length);

  if (out.includes(focusMarker)) fail('capture focusout encore présente', 14);
  if (!out.includes("captureNow('change-immediate')")) fail('capture change-immediate absente', 15);
  if (!out.includes("await captureNow('navigation-before-guaranteed')")) fail('capture garantie avant navigation absente', 16);
  checkJs(out, 'replay-navigation-capture.js');
  fs.writeFileSync(file, out, 'utf8');
}

console.log('SEB EvalPro: aucun screenshot Replay au simple clic/focus de cellule; captures de saisie et navigation conservées.');
