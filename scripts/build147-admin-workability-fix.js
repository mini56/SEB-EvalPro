const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Admin workability: ' + message);
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

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}

// -----------------------------------------------------------------------------
// PRIORITE BLOQUANTE ADMIN
// Le moteur de replay visuel ne doit JAMAIS capturer pendant le travail Admin.
// Une capture pleine page utilise le debugger Chromium + Page.captureScreenshot;
// elle est utile au parcours candidat, mais elle ne doit pas se déclencher lors
// d'une saisie, d'un clic ou d'un changement de sélection dans l'Admin.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  if (!out.includes('function adminWorkBlocked()')) {
    const marker = 'async function captureCurrentPage(reason = \'state\', force = false) {';
    const helper = `function adminWorkBlocked() {\n  const page = pageName().toLowerCase();\n  if (page === 'admin-bilan.html' || page === 'bilan.html') return true;\n  return !!(\n    document.getElementById('seb-bilan-history-chooser') ||\n    document.getElementById('seb-bilan-history-editor') ||\n    document.getElementById('seb-evalpro-admin-dialog') ||\n    document.getElementById('seb-evalpro-session-close-dialog')\n  );\n}\n\n`;
    if (!out.includes(marker)) fail('captureCurrentPage introuvable dans replay-preload', 4);
    out = out.replace(marker, helper + marker);
  }

  out = replaceOnce(
    out,
    `async function captureCurrentPage(reason = 'state', force = false) {\n  if (!document.body) return { ok: false };`,
    `async function captureCurrentPage(reason = 'state', force = false) {\n  if (!document.body) return { ok: false };\n  if (adminWorkBlocked()) return { ok: false, adminWorkBlocked: true };`,
    'garde capture replay Admin'
  );

  out = replaceOnce(
    out,
    `function scheduleCapture(reason, delay = 350) {\n  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;`,
    `function scheduleCapture(reason, delay = 350) {\n  if (adminWorkBlocked()) return;\n  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;`,
    'garde debounce replay Admin'
  );

  out = replaceOnce(
    out,
    `function installCaptureRecorder() {\n  if (!document.body) return;`,
    `function installCaptureRecorder() {\n  if (!document.body || adminWorkBlocked()) return;`,
    'désactivation recorder replay sur page Admin'
  );

  for (const required of [
    'function adminWorkBlocked()',
    "page === 'admin-bilan.html' || page === 'bilan.html'",
    "document.getElementById('seb-bilan-history-editor')",
    'if (adminWorkBlocked()) return { ok: false, adminWorkBlocked: true };',
    'if (!document.body || adminWorkBlocked()) return;'
  ]) {
    if (!out.includes(required)) fail('garde replay Admin absente: ' + required, 5);
  }
  try { new vm.Script(out); } catch (error) { fail('replay-preload.js invalide: ' + error.message, 6); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// Le second capteur replay (navigation/change/focusout) est lui aussi coupé dans
// l'Admin et dans l'éditeur historique. Aucun focusout de textarea Admin ne doit
// provoquer Page.captureScreenshot.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-navigation-capture.js');
  let out = text;

  if (!out.includes('function adminWorkBlocked()')) {
    const marker = 'async function captureNow(reason) {';
    const helper = `function adminWorkBlocked() {\n  const page = pageName().toLowerCase();\n  if (page === 'admin-bilan.html' || page === 'bilan.html') return true;\n  return !!(\n    document.getElementById('seb-bilan-history-chooser') ||\n    document.getElementById('seb-bilan-history-editor') ||\n    document.getElementById('seb-evalpro-admin-dialog') ||\n    document.getElementById('seb-evalpro-session-close-dialog')\n  );\n}\n\n`;
    if (!out.includes(marker)) fail('captureNow introuvable dans replay-navigation-capture', 7);
    out = out.replace(marker, helper + marker);
  }

  out = replaceOnce(
    out,
    `async function captureNow(reason) {\n  if (!document.body || replayBlocked()) return false;`,
    `async function captureNow(reason) {\n  if (!document.body || replayBlocked() || adminWorkBlocked()) return false;`,
    'garde capture navigation Admin'
  );

  out = replaceOnce(
    out,
    `function install() {\n  if (installed) return;\n  installed = true;`,
    `function install() {\n  if (installed) return;\n  installed = true;\n  if (adminWorkBlocked()) return;`,
    'désactivation capteur navigation sur page Admin'
  );

  for (const required of [
    'function adminWorkBlocked()',
    'replayBlocked() || adminWorkBlocked()',
    'installed = true;\n  if (adminWorkBlocked()) return;'
  ]) {
    if (!out.includes(required)) fail('garde navigation Admin absente: ' + required, 8);
  }
  try { new vm.Script(out); } catch (error) { fail('replay-navigation-capture.js invalide: ' + error.message, 9); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// Backend de capture : dernière barrière de sécurité. Même si un listener ancien
// essayait encore d'appeler l'IPC depuis admin-bilan.html/bilan.html, le backend
// refuse AVANT d'attacher le debugger Chromium.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-main.js');
  let out = text;
  if (!out.includes('SEB_ADMIN_CAPTURE_BACKEND_GUARD')) {
    out = replaceOnce(
      out,
      `  async function capturePage(event, payload) {\n    try {`,
      `  async function capturePage(event, payload) {\n    try {\n      // SEB_ADMIN_CAPTURE_BACKEND_GUARD\n      let senderPage = '';\n      try { senderPage = path.basename(new URL(event.sender.getURL()).pathname).toLowerCase(); } catch (_) {}\n      if (senderPage === 'admin-bilan.html' || senderPage === 'bilan.html') {\n        return { ok: false, skipped: true, adminWorkBlocked: true };\n      }`,
      'barrière backend capture Admin'
    );
  }
  if (!out.includes('SEB_ADMIN_CAPTURE_BACKEND_GUARD') || !out.includes("senderPage === 'admin-bilan.html'")) {
    fail('barrière backend replay Admin absente', 10);
  }
  try { new vm.Script(out); } catch (error) { fail('replay-main.js invalide: ' + error.message, 11); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// Sauvegarde globale du shell : sur la page Bilan Admin, supprimer les listeners
// de sauvegarde à chaque frappe/clic et le timer toutes les secondes. Le bilan a
// déjà ses propres commandes de sauvegarde explicites. Cela évite toute activité
// de fond inutile pendant la saisie sans supprimer la fonction sebEvalPro.save().
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;
  const oldBlock = `  document.addEventListener('input', scheduleSave, true);\n  document.addEventListener('change', scheduleSave, true);\n  document.addEventListener('click', scheduleSave, true);\n  periodicSaveTimer = setInterval(() => saveNow(false), 1000);`;
  const newBlock = `  if (!isAdminBilanPage()) {\n    document.addEventListener('input', scheduleSave, true);\n    document.addEventListener('change', scheduleSave, true);\n    document.addEventListener('click', scheduleSave, true);\n    periodicSaveTimer = setInterval(() => saveNow(false), 1000);\n  }`;
  const guardedBlock = "if (!isAdminBilanPage()) {\n    document.addEventListener('input', scheduleSave, true);";
  const resultsOldBlock = "  } else {\n    document.addEventListener('input', scheduleSave, true);\n    document.addEventListener('change', scheduleSave, true);\n    document.addEventListener('click', scheduleSave, true);\n    periodicSaveTimer = setInterval(() => saveNow(false), 1000);\n  }";
  const resultsGuardedBlock = "  } else if (!isAdminBilanPage()) {\n    document.addEventListener('input', scheduleSave, true);\n    document.addEventListener('change', scheduleSave, true);\n    document.addEventListener('click', scheduleSave, true);\n    periodicSaveTimer = setInterval(() => saveNow(false), 1000);\n  }";
  if (out.includes(oldBlock)) out = out.replace(oldBlock, newBlock);
  else if (out.includes(resultsOldBlock)) out = out.replace(resultsOldBlock, resultsGuardedBlock);
  else if (!out.includes(guardedBlock) && !out.includes(resultsGuardedBlock)) {
    fail('bloc sauvegarde globale DOM introuvable', 12);
  }
  if (!out.includes(guardedBlock) && !out.includes(resultsGuardedBlock)) {
    fail('sauvegarde globale encore active à chaque frappe en Admin', 13);
  }
  try { new vm.Script(out); } catch (error) { fail('preload.js invalide: ' + error.message, 14); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// Historique Bilan : l'observer n'a aucune raison de surveiller tout le document
// pendant que l'utilisateur tape. On le limite strictement à la barre Admin.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  const oldObserve = `  observer.observe(document.documentElement, { childList: true, subtree: true });`;
  const newObserve = `  const adminBar = document.getElementById('seb-evalpro-topbar');\n  if (adminBar) observer.observe(adminBar, { childList: true, subtree: false });`;
  if (out.includes(oldObserve)) out = out.replace(oldObserve, newObserve);
  else if (!out.includes("observer.observe(adminBar, { childList: true, subtree: false })")) {
    fail('MutationObserver historique global introuvable', 15);
  }
  if (out.includes('observer.observe(document.documentElement, { childList: true, subtree: true })')) {
    fail('MutationObserver historique surveille encore tout le document', 16);
  }
  try { new vm.Script(out); } catch (error) { fail('bilan-history-preload.js invalide: ' + error.message, 17); }
  write(file, out);
}

console.log('SEB EvalPro Build Admin prioritaire: replay/captures/debugger totalement interdits pendant le travail Admin; sauvegardes globales par frappe coupées sur le bilan; observer historique limité à la barre Admin.');
