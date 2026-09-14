const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #151 finalisation parcours/Admin: ' + message);
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
// 1. Le parcours candidat s'arrête définitivement à l'ouverture de Résultats.
//    Une dernière capture explicite de Résultats reste autorisée pour l'archive,
//    puis aucun clic/saisie Admin ne peut relancer le moteur de capture.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;

  if (!out.includes('SEB_RESULTS_CAPTURE_STOP')) {
    const marker = 'async function captureCurrentPage(reason = \'state\', force = false) {';
    const helper = `// SEB_RESULTS_CAPTURE_STOP\nfunction replayCaptureStopped() {\n  try { return window.sessionStorage.getItem('seb_evalpro_replay_capture_stopped') === '1'; }\n  catch (_) { return false; }\n}\n\nfunction stopReplayCaptureAfterResults() {\n  try { window.sessionStorage.setItem('seb_evalpro_replay_capture_stopped', '1'); } catch (_) {}\n  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }\n}\n\n`;
    out = replaceRequired(out, marker, helper + marker, 'garde arrêt capture après Résultats');
  }

  out = replaceRequired(
    out,
    `async function captureCurrentPage(reason = 'state', force = false) {\n  if (!document.body) return { ok: false };`,
    `async function captureCurrentPage(reason = 'state', force = false) {\n  if (!document.body) return { ok: false };\n  if (replayCaptureStopped() && reason !== 'final-results') return { ok: false, resultsComplete: true };`,
    'blocage de toute capture hors dernière capture Résultats'
  );

  out = replaceRequired(
    out,
    `function scheduleCapture(reason, delay = 350) {\n  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;`,
    `function scheduleCapture(reason, delay = 350) {\n  if (replayCaptureStopped()) return;\n  if (window.sessionStorage.getItem('seb_evalpro_replay_archive_file')) return;`,
    'annulation des captures différées après Résultats'
  );

  // Build #135 transforme archiveIfFinalVisible et pose seb_evalpro_results_seen.
  // Dès que la page finale est réellement visible, on ferme le moteur général.
  out = replaceRequired(
    out,
    `  try { window.sessionStorage.setItem('seb_evalpro_results_seen', '1'); } catch (_) {}`,
    `  try { window.sessionStorage.setItem('seb_evalpro_results_seen', '1'); } catch (_) {}\n  stopReplayCaptureAfterResults();`,
    'arrêt immédiat du moteur à l’arrivée sur Résultats'
  );

  // Une session déjà archivée et revenue sur Résultats reste également arrêtée.
  out = replaceRequired(
    out,
    `  const existing = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');\n  if (existing) return { ok: true, filename: existing, alreadyArchived: true };`,
    `  const existing = window.sessionStorage.getItem('seb_evalpro_replay_archive_file');\n  if (existing) { stopReplayCaptureAfterResults(); return { ok: true, filename: existing, alreadyArchived: true }; }`,
    'arrêt capture pour parcours déjà archivé'
  );

  for (const token of [
    'SEB_RESULTS_CAPTURE_STOP',
    "seb_evalpro_replay_capture_stopped",
    "reason !== 'final-results'",
    'stopReplayCaptureAfterResults();',
    'if (replayCaptureStopped()) return;'
  ]) if (!out.includes(token)) fail('contrôle arrêt Résultats absent: ' + token, 5);

  checkJs(out, 'replay-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Ancien bilan : changer un commentaire doit synchroniser ENSEMBLE
//    le texte du commentaire et le niveau/couleur associé.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  const oldHandler = `      select.addEventListener('change', () => { const chosen = select.options[select.selectedIndex]; const level = chosen && chosen.dataset.level; if (level && ['NE','I','II','III'].includes(level)) { tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.toggle('on', cell.dataset.level === level)); } });`;
  const newHandler = `      select.addEventListener('change', () => {\n        const chosen = select.options[select.selectedIndex];\n        const level = chosen && chosen.dataset.level;\n        if (level && ['NE','I','II','III'].includes(level)) {\n          tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.toggle('on', cell.dataset.level === level));\n        } else {\n          tr.querySelectorAll('.seb-bh-level').forEach((cell) => cell.classList.remove('on'));\n        }\n        const comment = tr.querySelector('.seb-bh-comment');\n        if (comment) comment.value = chosen ? String(chosen.value || '') : '';\n      });`;

  out = replaceRequired(out, oldHandler, newHandler, 'synchronisation commentaire/niveau historique');

  for (const token of [
    "const comment = tr.querySelector('.seb-bh-comment');",
    "comment.value = chosen ? String(chosen.value || '') : '';",
    "cell.classList.remove('on')"
  ]) if (!out.includes(token)) fail('synchronisation historique absente: ' + token, 6);

  checkJs(out, 'bilan-history-preload.js après synchronisation');
  write(file, out);
}

// -----------------------------------------------------------------------------
// 3. Word institutionnel : NE / I / II / III ont strictement la même largeur.
//    Modules = 40 %, chaque niveau = 7,5 %, Commentaires = 30 % (total 100 %).
//    Les cases de niveau du corps restent vides et uniquement colorées.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  const anchor = `  const table = parsed.getElementById('bilan');\n  if (!table) throw new Error('Tableau institutionnel introuvable dans le modèle.');`;
  const widthBlock = `  const table = parsed.getElementById('bilan');\n  if (!table) throw new Error('Tableau institutionnel introuvable dans le modèle.');\n\n  // SEB_WORD_EQUAL_LEVEL_WIDTHS : Word doit recevoir des largeurs explicites.\n  const wordWidths = ['40%','7.5%','7.5%','7.5%','7.5%','30%'];\n  const oldColgroup = table.querySelector('colgroup');\n  if (oldColgroup) oldColgroup.remove();\n  const colgroup = parsed.createElement('colgroup');\n  wordWidths.forEach((width) => {\n    const col = parsed.createElement('col');\n    col.style.width = width;\n    col.setAttribute('width', width);\n    colgroup.appendChild(col);\n  });\n  table.insertBefore(colgroup, table.firstChild);\n  table.querySelectorAll('tr').forEach((tr) => {\n    const cells = Array.from(tr.children || []);\n    if (cells.length !== 6) return;\n    cells.forEach((cell, index) => {\n      cell.style.width = wordWidths[index];\n      cell.setAttribute('width', wordWidths[index]);\n    });\n  });`;

  out = replaceRequired(out, anchor, widthBlock, 'largeurs égales des colonnes Word');

  // Renforcer aussi le CSS Word, utile avec les versions de Word qui réinterprètent le colgroup.
  const cssOld = 'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:4pt;vertical-align:top}';
  const cssNew = 'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:4pt;vertical-align:top}th:nth-child(2),th:nth-child(3),th:nth-child(4),th:nth-child(5),td:nth-child(2),td:nth-child(3),td:nth-child(4),td:nth-child(5){width:7.5%}';
  out = replaceRequired(out, cssOld, cssNew, 'CSS Word largeurs niveaux égales');

  for (const token of [
    'SEB_WORD_EQUAL_LEVEL_WIDTHS',
    "const wordWidths = ['40%','7.5%','7.5%','7.5%','7.5%','30%'];",
    "col.setAttribute('width', width);",
    'td:nth-child(5){width:7.5%}'
  ]) if (!out.includes(token)) fail('largeur Word non garantie: ' + token, 7);

  if (out.includes('content:attr(data-level)')) fail('régression: lettres de niveau historiques réapparues', 8);
  checkJs(out, 'bilan-history-preload.js final');
  write(file, out);
}

console.log('SEB EvalPro Build #151: captures arrêtées dès Résultats (dernière capture Résultats seulement), commentaire/niveau des anciens bilans synchronisés et colonnes Word NE/I/II/III strictement égales.');
