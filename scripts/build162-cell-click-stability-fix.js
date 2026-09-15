const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #162 cell click stability: ' + message);
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
  const clickBlock = `  document.addEventListener('click', (event) => {\n    if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;\n    const target = event.target && event.target.closest ? event.target.closest('button,a,input,select,textarea,[contenteditable]') : null;\n    if (!target) return;\n    captureCurrentPage('before-action', true);\n    scheduleCapture('after-action', 320);\n  }, true);\n`;
  if (!out.includes(clickBlock)) fail('listener de capture générique au clic introuvable', 5);
  out = out.replace(clickBlock, '');
  if (out.includes("captureCurrentPage('before-action', true)")) fail('capture before-action encore présente', 6);
  if (!out.includes("scheduleCapture('input', 450)")) fail('capture input absente', 7);
  if (!out.includes("scheduleCapture('change', 220)")) fail('capture change absente', 8);
  checkJs(out, 'replay-preload.js');
  fs.writeFileSync(file, out, 'utf8');
}

// Le focusout se produit précisément quand on clique dans une autre cellule.
// Il lançait une seconde capture plein écran ~70 ms après le clic. Le change
// immédiat suffit à conserver l'état saisi sans provoquer ce rendu parasite.
{
  const { file, text } = read('src/replay-navigation-capture.js');
  let out = text;
  const focusoutBlock = `  document.addEventListener('focusout', () => {\n    setTimeout(() => { captureNow('focusout'); }, 70);\n  }, true);\n`;
  if (!out.includes(focusoutBlock)) fail('listener focusout Replay introuvable', 9);
  out = out.replace(focusoutBlock, '');
  if (out.includes("captureNow('focusout')")) fail('capture focusout encore présente', 10);
  if (!out.includes("captureNow('change-immediate')")) fail('capture change-immediate absente', 11);
  if (!out.includes("await captureNow('navigation-before-guaranteed')")) fail('capture garantie avant navigation absente', 12);
  checkJs(out, 'replay-navigation-capture.js');
  fs.writeFileSync(file, out, 'utf8');
}

console.log('SEB EvalPro Build #162: aucun screenshot Replay au simple clic/focus de cellule; captures de saisie et navigation conservées.');
