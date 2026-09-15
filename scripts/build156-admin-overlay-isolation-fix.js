const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #156 Admin overlay isolation: ' + message);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}

function checkJs(text, label) {
  try { new vm.Script(text); }
  catch (error) { fail(`${label} invalide: ${error.message}`, 4); }
}

// Base fonctionnelle : #153. Les correctifs #154/#155 ne sont volontairement
// plus exécutés. On isole seulement les éléments fixes ajoutés après #134.
{
  const { file, text } = read('src/preload.js');
  let out = text;
  out = out.replace('html{box-sizing:border-box;scrollbar-gutter:stable}', 'html{box-sizing:border-box}');
  out = replaceRequired(out,
    '#seb-evalpro-admin-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}',
    '#seb-evalpro-admin-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;contain:layout paint;overflow:hidden;max-width:100vw;max-height:100vh}',
    'isolation boîte mot de passe Admin');
  out = replaceRequired(out,
    '#seb-evalpro-session-close-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}',
    '#seb-evalpro-session-close-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;contain:layout paint;overflow:hidden;max-width:100vw;max-height:100vh}',
    'isolation boîte fermeture session');
  out = replaceRequired(out,
    'transition:transform .16s ease;will-change:transform}',
    'transition:transform .16s ease;will-change:transform;contain:layout paint;max-width:100vw;overflow:hidden}',
    'isolation barre Admin');
  for (const forbidden of ['lockHorizontalPosition','window.scrollTo(0, window.scrollY)']) {
    if (out.includes(forbidden)) fail('mécanisme global de scroll interdit encore présent: ' + forbidden, 5);
  }
  checkJs(out, 'src/preload.js');
  write(file, out);
}

{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  out = replaceRequired(out,
    '#seb-bilan-history-chooser,#seb-bilan-history-editor{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}',
    '#seb-bilan-history-chooser,#seb-bilan-history-editor{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;contain:layout paint;overflow:hidden;max-width:100vw;max-height:100vh}',
    'isolation overlay historique');
  out = replaceRequired(out,
    '.seb-bh-body{flex:1;min-height:0;min-width:0;padding:15px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;background:#f5f7fb}',
    '.seb-bh-body{flex:1;min-height:0;min-width:0;padding:15px;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb}',
    'scroll permanent sélecteur historique');
  out = replaceRequired(out,
    '.seb-bh-editor-body{flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding:16px;background:#fff}',
    '.seb-bh-editor-body{flex:1;min-height:0;min-width:0;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;padding:16px;background:#fff}',
    'scroll permanent éditeur historique');
  out = out.replace(/function lockAdminModalPage\(\) \{[\s\S]*?\n\}\nfunction unlockAdminModalPage\(\) \{[\s\S]*?\n\}/,
    'function lockAdminModalPage() {}\nfunction unlockAdminModalPage() {}');
  out = out.replace(/document\.documentElement\.classList\.(?:add|remove)\('seb-admin-modal-open'\);?/g, '');
  out = out.replace(/html\.seb-admin-modal-open\{[^}]*\}\s*/g, '');
  out = out.replace(/html\.seb-admin-modal-open body\{[^}]*\}\s*/g, '');
  for (const forbidden of ["classList.add('seb-admin-modal-open')", 'html.seb-admin-modal-open{', 'scrollbar-gutter:stable']) {
    if (out.includes(forbidden)) fail('ancien verrou historique encore présent: ' + forbidden, 6);
  }
  for (const required of [
    '.seb-bh-body{flex:1;min-height:0;min-width:0;padding:15px;overflow-y:scroll;',
    '.seb-bh-editor-body{flex:1;min-height:0;min-width:0;overflow-y:scroll;',
    'function lockAdminModalPage() {}'
  ]) if (!out.includes(required)) fail('isolation historique incomplète: ' + required, 7);
  checkJs(out, 'src/bilan-history-preload.js');
  write(file, out);
}

{
  const { file, text } = read('src/replay-preload.js');
  let out = text;
  out = replaceRequired(out,
    '#seb-replay-chooser,#seb-replay-viewer{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}',
    '#seb-replay-chooser,#seb-replay-viewer{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;contain:layout paint;overflow:hidden;max-width:100vw;max-height:100vh}',
    'isolation overlay Replay');
  out = replaceRequired(out,
    '.seb-replay-body{flex:1;min-height:0;min-width:0;padding:16px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;background:#f5f7fb}',
    '.seb-replay-body{flex:1;min-height:0;min-width:0;padding:16px;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb}',
    'scroll permanent Replay');
  if (out.includes('scrollbar-gutter:stable')) fail('gouttière Replay encore présente', 8);
  checkJs(out, 'src/replay-preload.js');
  write(file, out);
}

console.log('SEB EvalPro: base #153 restaurée; overlays Admin/Historique/Replay isolés du document et scroll interne permanent sans modification html/body.');
