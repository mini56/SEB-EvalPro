const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function fail(message, code = 2) {
  console.error('SEB EvalPro clean Admin replay guard: ' + message);
  process.exit(code);
}
function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}
function checkJs(text, label) {
  try { new vm.Script(text); }
  catch (error) { fail(`${label} invalide: ${error.message}`, 4); }
}

// Garde Admin uniquement. Aucun CSS de scroll, aucune scrollbar, aucune géométrie n'est modifiée.
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
  const recorderStart = out.indexOf('function installCaptureRecorder()');
  const recorderEnd = out.indexOf('\n}\n\nfunction installArchiveWatcher()', recorderStart);
  const clickMarker = `  document.addEventListener('click', (event) => {`;
  const clickAt = out.indexOf(clickMarker, recorderStart);
  if (recorderStart < 0 || recorderEnd < 0 || clickAt < recorderStart || clickAt > recorderEnd) fail('listener click replay introuvable', 6);
  const segment = out.slice(recorderStart, recorderEnd);
  if (!segment.includes('adminInteractionTarget(event.target)')) {
    const insertAt = clickAt + clickMarker.length;
    out = out.slice(0, insertAt) + `\n    if (adminWorkBlocked() || adminInteractionTarget(event.target)) return;` + out.slice(insertAt);
  }
  for (const token of ['function adminInteractionTarget(target)', 'adminInteractionTarget(event.target)', "document.getElementById('seb-replay-viewer')"]) {
    if (!out.includes(token)) fail('garde replay Admin absente: ' + token, 7);
  }
  checkJs(out, 'replay-preload.js');
  write(file, out);
}

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
  if (!helperRe.test(out)) fail('adminWorkBlocked absent de replay-navigation-capture', 8);
  out = out.replace(helperRe, adminHelper);
  out = replaceRequired(
    out,
    `  document.addEventListener('click', async (event) => {\n    if (replayingNavigation || replayBlocked()) return;`,
    `  document.addEventListener('click', async (event) => {\n    if (replayingNavigation || replayBlocked() || adminWorkBlocked() || adminInteractionTarget(event.target)) return;`,
    'filtre navigation Admin'
  );
  checkJs(out, 'replay-navigation-capture.js');
  write(file, out);
}

{
  const { file, text } = read('src/replay-main.js');
  let out = text;
  if (!out.includes('SEB_ADMIN_CAPTURE_ADMINMODE_GUARD')) {
    const marker6 = `      // SEB_ADMIN_CAPTURE_BACKEND_GUARD\n      let senderPage = '';`;
    const marker4 = `    // SEB_ADMIN_CAPTURE_BACKEND_GUARD\n    let senderPage = '';`;
    const marker = out.includes(marker6) ? marker6 : marker4;
    const indent = marker === marker6 ? '      ' : '    ';
    const replacement = indent + `// SEB_ADMIN_CAPTURE_BACKEND_GUARD\n` +
      indent + `// SEB_ADMIN_CAPTURE_ADMINMODE_GUARD\n` +
      indent + `if (getAdminUnlocked()) {\n` +
      indent + `  return { ok: false, skipped: true, adminWorkBlocked: true };\n` +
      indent + `}\n` +
      indent + `let senderPage = '';`;
    out = replaceRequired(out, marker, replacement, 'barrière backend mode Admin');
  }
  if (!out.includes('SEB_ADMIN_CAPTURE_ADMINMODE_GUARD') || !out.includes('if (getAdminUnlocked())')) fail('barrière backend Admin absente', 9);
  checkJs(out, 'replay-main.js');
  write(file, out);
}

// Ancien bilan : cases de niveau colorées mais sans lettres. Aucune géométrie/scroll modifiée.
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  const dynamic = `.seb-bh-level.on:after{content:attr(data-level);font-weight:700;font-size:16px}`;
  if (out.includes(dynamic)) out = out.replace(dynamic, `.seb-bh-level.on:after{content:none}`);
  if (out.includes('content:attr(data-level)')) fail('lettres NE/I/II/III encore injectées dans les cases historiques', 10);
  checkJs(out, 'bilan-history-preload.js');
  write(file, out);
}

console.log('SEB EvalPro clean: Replay interdit pendant tout travail Admin; cases historiques sans lettres; aucune modification de layout/scroll.');