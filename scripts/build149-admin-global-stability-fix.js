const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #149 Admin global: ' + message);
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

// -----------------------------------------------------------------------------
// 1. Replay preload : aucune capture pendant TOUTE interaction Admin.
//    Le premier clic sur « Administrateur » doit être filtré AVANT l'ouverture
//    de la boîte de mot de passe, sinon le capteur before-action part trop tôt.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  const adminHelper = `function adminWorkBlocked() {
  const page = pageName().toLowerCase();
  if (page === 'admin-bilan.html' || page === 'bilan.html') return true;
  const adminButton = document.getElementById('seb-evalpro-admin');
  if (adminButton && /^verrouiller$/i.test(String(adminButton.textContent || '').trim())) return true;
  return !!(
    document.getElementById('seb-evalpro-admin-dialog') ||
    document.getElementById('seb-evalpro-session-close-dialog') ||
    document.getElementById('seb-bilan-history-chooser') ||
    document.getElementById('seb-bilan-history-editor') ||
    document.getElementById('seb-replay-chooser') ||
    document.getElementById('seb-replay-viewer')
  );
}

function adminInteractionTarget(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-bilan-history-chooser,#seb-bilan-history-editor,#seb-replay-chooser,#seb-replay-viewer');
}`;

  const helperRe = /function adminWorkBlocked\(\) \{[\s\S]*?\n\}/;
  if (!helperRe.test(out)) fail('adminWorkBlocked absent de replay-preload', 5);
  out = out.replace(helperRe, adminHelper);

  out = replaceRequired(
    out,
    `  document.addEventListener('input', () => scheduleCapture('input', 450), true);\n  document.addEventListener('change', () => scheduleCapture('change', 220), true);`,
    `  document.addEventListener('input', (event) => {\n    if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;\n    scheduleCapture('input', 450);\n  }, true);\n  document.addEventListener('change', (event) => {\n    if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;\n    scheduleCapture('change', 220);\n  }, true);`,
    'filtres input/change Admin du replay'
  );

  out = replaceRequired(
    out,
    `  document.addEventListener('click', (event) => {\n    const target = event.target && event.target.closest ? event.target.closest('button,a,input,select,textarea,[contenteditable]') : null;\n    if (!target) return;\n    captureCurrentPage('before-action', true);\n    scheduleCapture('after-action', 320);\n  }, true);`,
    `  document.addEventListener('click', (event) => {\n    if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;\n    const target = event.target && event.target.closest ? event.target.closest('button,a,input,select,textarea,[contenteditable]') : null;\n    if (!target) return;\n    captureCurrentPage('before-action', true);\n    scheduleCapture('after-action', 320);\n  }, true);`,
    'filtre premier clic Administrateur'
  );

  for (const token of [
    'function adminInteractionTarget(target)',
    "target.closest('#seb-evalpro-topbar",
    "if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;",
    "document.getElementById('seb-evalpro-admin-dialog')",
    "document.getElementById('seb-replay-viewer')"
  ]) if (!out.includes(token)) fail('garde replay Admin absente: ' + token, 6);

  checkJs(out, 'replay-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Second capteur replay : même règle globale Admin.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-navigation-capture.js');
  let out = text;

  const adminHelper = `function adminWorkBlocked() {
  const page = pageName().toLowerCase();
  if (page === 'admin-bilan.html' || page === 'bilan.html') return true;
  const adminButton = document.getElementById('seb-evalpro-admin');
  if (adminButton && /^verrouiller$/i.test(String(adminButton.textContent || '').trim())) return true;
  return !!(
    document.getElementById('seb-evalpro-admin-dialog') ||
    document.getElementById('seb-evalpro-session-close-dialog') ||
    document.getElementById('seb-bilan-history-chooser') ||
    document.getElementById('seb-bilan-history-editor') ||
    document.getElementById('seb-replay-chooser') ||
    document.getElementById('seb-replay-viewer')
  );
}

function adminInteractionTarget(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-bilan-history-chooser,#seb-bilan-history-editor,#seb-replay-chooser,#seb-replay-viewer');
}`;

  const helperRe = /function adminWorkBlocked\(\) \{[\s\S]*?\n\}/;
  if (!helperRe.test(out)) fail('adminWorkBlocked absent de replay-navigation-capture', 7);
  out = out.replace(helperRe, adminHelper);

  out = replaceRequired(
    out,
    `  document.addEventListener('click', async (event) => {\n    if (replayingNavigation || replayBlocked()) return;`,
    `  document.addEventListener('click', async (event) => {\n    if (replayingNavigation || replayBlocked() || adminWorkBlocked() || adminInteractionTarget(event.target)) return;`,
    'filtre navigation Admin'
  );

  for (const token of [
    'function adminInteractionTarget(target)',
    'replayBlocked() || adminWorkBlocked()',
    'adminInteractionTarget(event.target)'
  ]) if (!out.includes(token)) fail('garde navigation Admin absente: ' + token, 8);

  checkJs(out, 'replay-navigation-capture.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 3. Backend replay : barrière absolue. Une fois le mode Admin déverrouillé,
//    aucune requête de capture ne peut attacher le debugger Chromium.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-main.js');
  let out = text;
  if (!out.includes('SEB_ADMIN_CAPTURE_ADMINMODE_GUARD')) {
    const marker = `      // SEB_ADMIN_CAPTURE_BACKEND_GUARD\n      let senderPage = '';`;
    const replacement = `      // SEB_ADMIN_CAPTURE_BACKEND_GUARD\n      // SEB_ADMIN_CAPTURE_ADMINMODE_GUARD\n      if (getAdminUnlocked()) {\n        return { ok: false, skipped: true, adminWorkBlocked: true };\n      }\n      let senderPage = '';`;
    out = replaceRequired(out, marker, replacement, 'barrière backend mode Admin');
  }
  if (!out.includes('SEB_ADMIN_CAPTURE_ADMINMODE_GUARD') || !out.includes('if (getAdminUnlocked())')) {
    fail('barrière backend Admin non installée', 9);
  }
  checkJs(out, 'replay-main.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 4. Bilans historiques : scroll interne fiable, sans modifier la largeur du
//    document derrière. On ne verrouille plus html/body : l'overlay fixe et
//    overscroll-behavior:contain suffisent, et évitent le saut de scrollbar.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  out = out.replace(
    `    html.seb-admin-modal-open{overflow-y:hidden!important;scrollbar-gutter:stable}\n    html.seb-admin-modal-open body{overflow:hidden!important}\n`,
    ''
  );

  out = replaceRequired(
    out,
    `.seb-bh-card{width:min(1040px,96vw);max-height:90vh;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}`,
    `.seb-bh-card{width:min(1040px,96vw);max-height:90vh;min-height:0;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:flex;flex-direction:column;overflow:hidden}`,
    'carte sélecteur historique'
  );

  out = replaceRequired(
    out,
    `.seb-bh-body{padding:15px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb;min-width:0}`,
    `.seb-bh-body{flex:1;min-height:0;min-width:0;padding:15px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;background:#f5f7fb}`,
    'scroll sélecteur historique'
  );

  out = replaceRequired(
    out,
    `.seb-bh-editor-card{width:98vw;height:94vh;background:#fff;border-radius:8px;box-shadow:0 16px 50px rgba(0,0,0,.42);display:flex;flex-direction:column;overflow:hidden}`,
    `.seb-bh-editor-card{width:98vw;height:94vh;min-height:0;background:#fff;border-radius:8px;box-shadow:0 16px 50px rgba(0,0,0,.42);display:flex;flex-direction:column;overflow:hidden}`,
    'carte éditeur historique'
  );

  out = replaceRequired(
    out,
    `.seb-bh-editor-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:16px;background:#fff}`,
    `.seb-bh-editor-body{flex:1;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding:16px;background:#fff}`,
    'scroll éditeur historique'
  );

  const lockOld = `function lockAdminModalPage() {\n  sebAdminModalDepth += 1;\n  if (sebAdminModalDepth === 1) document.documentElement.classList.add('seb-admin-modal-open');\n}\nfunction unlockAdminModalPage() {\n  if (sebAdminModalDepth <= 0) return;\n  sebAdminModalDepth -= 1;\n  if (sebAdminModalDepth === 0) document.documentElement.classList.remove('seb-admin-modal-open');\n}`;
  const lockNew = `function lockAdminModalPage() {\n  sebAdminModalDepth += 1;\n}\nfunction unlockAdminModalPage() {\n  if (sebAdminModalDepth <= 0) return;\n  sebAdminModalDepth -= 1;\n  document.documentElement.classList.remove('seb-admin-modal-open');\n}`;
  out = replaceRequired(out, lockOld, lockNew, 'suppression verrou html/body historique');

  for (const token of [
    '.seb-bh-body{flex:1;min-height:0;',
    '.seb-bh-editor-body{flex:1;min-height:0;',
    'scrollbar-gutter:stable',
    'overscroll-behavior:contain'
  ]) if (!out.includes(token)) fail('scroll historique incomplet: ' + token, 10);

  for (const forbidden of [
    'html.seb-admin-modal-open{overflow-y:hidden',
    "classList.add('seb-admin-modal-open')"
  ]) if (out.includes(forbidden)) fail('verrou de page instable encore présent: ' + forbidden, 11);

  checkJs(out, 'bilan-history-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 5. Fenêtres Replay Admin : même discipline de scroll que les anciens bilans.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  out = replaceRequired(
    out,
    `.seb-replay-card{width:min(980px,95vw);max-height:88vh;background:#fff;border:1px solid #aaa;border-radius:10px;box-shadow:0 15px 48px rgba(0,0,0,.34);display:flex;flex-direction:column;overflow:hidden}`,
    `.seb-replay-card{width:min(980px,95vw);max-height:88vh;min-height:0;background:#fff;border:1px solid #aaa;border-radius:10px;box-shadow:0 15px 48px rgba(0,0,0,.34);display:flex;flex-direction:column;overflow:hidden}`,
    'carte Replay'
  );

  out = replaceRequired(
    out,
    `.seb-replay-body{padding:16px;overflow:auto;background:#f5f7fb;min-height:260px}`,
    `.seb-replay-body{flex:1;min-height:0;min-width:0;padding:16px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;background:#f5f7fb}`,
    'scroll liste Replay'
  );

  if (!out.includes('.seb-replay-body{flex:1;min-height:0;')) fail('scroll Replay non stabilisé', 12);
  checkJs(out, 'replay-preload.js après CSS');
  write(file, out);
}

console.log('SEB EvalPro Build #149: capture Replay totalement interdite pendant le mode Admin et dès le premier clic Administrateur; anciens bilans et Replay disposent d’un scroll interne stable sans verrouillage html/body.');
