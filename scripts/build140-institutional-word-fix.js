const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #140 Word institutionnel: ' + message);
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

// -----------------------------------------------------------------------------
// 1. Exposer au preload le vrai modèle institutionnel admin-bilan.html.
//    Le Word historique sera construit à partir de ce tableau, et non plus à
//    partir d'un tableau simplifié reconstruit de zéro.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-main.js');
  let out = text;
  if (!out.includes("bilan-history:get-word-template-sync")) {
    const closeMarker = '\n};\n';
    const closeIndex = out.lastIndexOf(closeMarker);
    if (closeIndex < 0) fail('fin de bilan-history-main.js introuvable', 3);
    const block = `
  ipcMain.on('bilan-history:get-word-template-sync', (event) => {
    if (!getAdminUnlocked()) {
      event.returnValue = { ok: false, error: 'Accès administrateur requis.' };
      return;
    }
    try {
      const templatePath = path.join(__dirname, '..', 'app', 'web', 'admin-bilan.html');
      if (!fs.existsSync(templatePath)) throw new Error('Modèle institutionnel du bilan introuvable.');
      const html = fs.readFileSync(templatePath, 'utf8');
      if (!html.includes('id="bilan"') || !html.includes('data-r="fabrication-plan"')) {
        throw new Error('Modèle institutionnel du bilan invalide.');
      }
      event.returnValue = { ok: true, html };
    } catch (error) {
      event.returnValue = { ok: false, error: error && error.message ? error.message : String(error) };
    }
  });
`;
    out = out.slice(0, closeIndex) + block + out.slice(closeIndex);
  }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Remplacer l'export simplifié du #139 par un export qui clone réellement
//    le tableau institutionnel. Les données de la révision historique sont
//    réinjectées ligne par ligne dans le modèle officiel, puis le .doc est écrit
//    directement sur disque par le writer fiable du #139.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  const start = out.indexOf('function exportHistoricalWord(card, candidate, originalBuild, revision) {');
  const endMarker = '\n}\n\nfunction install() {';
  const end = out.indexOf(endMarker, start);
  if (start < 0 || end < 0) fail('fonction exportHistoricalWord introuvable après le #139', 4);

  const replacement = `function exportHistoricalWord(card, candidate, originalBuild, revision) {
  const edited = buildEditorDocument(card);
  const templateResult = ipcRenderer.sendSync('bilan-history:get-word-template-sync');
  if (!templateResult || !templateResult.ok || !templateResult.html) {
    throw new Error((templateResult && templateResult.error) || 'Chargement du modèle institutionnel impossible.');
  }

  const parsed = new DOMParser().parseFromString(String(templateResult.html), 'text/html');
  const table = parsed.getElementById('bilan');
  if (!table) throw new Error('Tableau institutionnel introuvable dans le modèle.');

  const byKey = new Map((edited.rows || []).filter((row) => row && row.kind === 'item').map((row) => [String(row.key || ''), row]));
  const colours = { NE:['#CCFFFF','#000000'], I:['#92D050','#000000'], II:['#ED7D31','#FFFFFF'], III:['#C00000','#FFFFFF'] };
  const paint = (el, bg, fg) => {
    if (!el) return;
    el.style.backgroundColor = bg;
    el.setAttribute('bgcolor', bg);
    if (fg) {
      el.style.color = fg;
      el.setAttribute('color', fg);
    }
  };

  const headers = table.querySelectorAll('thead th');
  paint(headers[0], '#0070C0', '#FFFFFF');
  paint(headers[1], '#CCFFFF', '#000000');
  paint(headers[2], '#92D050', '#000000');
  paint(headers[3], '#ED7D31', '#FFFFFF');
  paint(headers[4], '#C00000', '#FFFFFF');
  paint(headers[5], '#0070C0', '#FFFFFF');
  table.querySelectorAll('tr.section td').forEach((el) => paint(el, '#9CC2E5', '#000000'));
  table.querySelectorAll('tr.section2 td').forEach((el) => paint(el, '#B8CCE4', '#000000'));
  table.querySelectorAll('tr.alt td').forEach((el) => paint(el, '#F2F2F2', '#000000'));

  table.querySelectorAll('tbody tr[data-r]').forEach((tr) => {
    const row = byKey.get(String(tr.getAttribute('data-r') || ''));
    if (!row) return;

    const level = ['NE','I','II','III'].includes(String(row.level || '')) ? String(row.level) : '';
    tr.setAttribute('data-level', level);
    tr.querySelectorAll('.level').forEach((cell) => {
      cell.classList.remove('on');
      const isAlt = tr.classList.contains('alt');
      paint(cell, isAlt ? '#F2F2F2' : '#FFFFFF', '#000000');
      if (String(cell.getAttribute('data-l') || '') === level) {
        cell.classList.add('on');
        const c = colours[level];
        if (c) paint(cell, c[0], c[1]);
      }
      // Les cases de niveau restent vides : NE/I/II/III n'apparaissent que
      // dans la première ligne d'en-tête, comme dans le document de référence.
      cell.querySelectorAll('.word-level-label').forEach((label) => label.remove());
    });

    const select = tr.querySelector('.csel');
    if (select) select.remove();

    const textarea = tr.querySelector('.ctxt');
    if (textarea) {
      const div = parsed.createElement('div');
      div.style.whiteSpace = 'pre-wrap';
      div.textContent = String(row.comment || row.preset || '');
      textarea.replaceWith(div);
    }

    const detail = tr.querySelector('.detail');
    if (detail) detail.textContent = String(row.detail || '');

    if (String(row.key) === 'tri-temps') {
      const avg = String(row.moduleText || '').match(/Moyenne\s+([0-9]{1,2}:[0-9]{2})/i);
      const avgEl = tr.querySelector('#triAvg');
      if (avg && avgEl) avgEl.textContent = avg[1].padStart(5, '0');
    }
    if (String(row.key) === 'tri-erreurs') {
      const err = String(row.moduleText || '').match(/([0-9]+)\s+erreur/i);
      const errEl = tr.querySelector('#triErr');
      if (err && errEl) errEl.textContent = err[1] + ' erreur' + (Number(err[1]) > 1 ? 's' : '');
    }
  });

  table.querySelectorAll('.csel').forEach((el) => el.remove());
  table.querySelectorAll('.ctxt').forEach((el) => {
    const div = parsed.createElement('div');
    div.style.whiteSpace = 'pre-wrap';
    div.textContent = String(el.value || '');
    el.replaceWith(div);
  });

  const style = '<style>@page Section1{size:595.35pt 841.95pt;mso-page-orientation:portrait;margin:28pt}div.Section1{page:Section1}body{font-family:Calibri,Arial;font-size:10pt}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:4pt;vertical-align:top}th{background:#0070c0;color:#fff}.nehead{background:#CCFFFF;color:#000}.ihead{background:#92D050;color:#000}.iihead{background:#ED7D31;color:#fff}.iiihead{background:#C00000;color:#fff}.alt td{background:#F2F2F2}.section td{background:#9CC2E5}.section2 td{background:#B8CCE4}.on[data-l="NE"]{background:#CCFFFF}.on[data-l="I"]{background:#92D050}.on[data-l="II"]{background:#ED7D31}.on[data-l="III"]{background:#C00000;color:#fff}</style>';
  const meta = '<p><b>Nom :</b> ' + escapeHtml(candidate.nom || '') + ' &nbsp; <b>Prénom :</b> ' + escapeHtml(candidate.prenom || '') + ' &nbsp; <b>Date :</b> ' + escapeHtml(candidate.date || '') + '</p>';
  const html = '<!doctype html><html><head><meta charset="utf-8">' + style + '</head><body><div class="Section1">' + meta + table.outerHTML + '</div></body></html>';

  const safe = (v) => String(v || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'CANDIDAT';
  const revisionNumber = Number.isFinite(Number(revision)) ? Number(revision) : 0;
  const revisionSuffix = '_R' + String(revisionNumber).padStart(2, '0');
  const wordFilename = 'Evaluation_' + safe(candidate.nom).toUpperCase() + '_' + safe(candidate.prenom).toUpperCase() + '_' + safe(candidate.date || '') + revisionSuffix + '.doc';
  const result = ipcRenderer.sendSync('bilan-history:write-word-sync', { filename: wordFilename, html, candidate });
  if (!result || !result.ok) throw new Error((result && result.error) || 'Écriture du document Word impossible.');
  return result.path || result.filename || wordFilename;
}`;

  out = out.slice(0, start) + replacement + out.slice(end + 2);
  write(file, out);
}

// Contrôles bloquants du rendu demandé par le document institutionnel de référence.
{
  const main = read('src/bilan-history-main.js').text;
  const preload = read('src/bilan-history-preload.js').text;
  const requiredMain = [
    "bilan-history:get-word-template-sync",
    "app', 'web', 'admin-bilan.html'",
    "bilan-history:write-word-sync"
  ];
  const requiredPreload = [
    "new DOMParser().parseFromString",
    "parsed.getElementById('bilan')",
    "@page Section1{size:595.35pt 841.95pt;mso-page-orientation:portrait;margin:28pt}",
    "Evaluation_' + safe(candidate.nom).toUpperCase()",
    "table.querySelectorAll('tr.alt td')",
    "cell.querySelectorAll('.word-level-label').forEach((label) => label.remove())",
    "ipcRenderer.sendSync('bilan-history:write-word-sync'"
  ];
  for (const token of requiredMain) if (!main.includes(token)) fail('contrôle backend absent: ' + token, 5);
  for (const token of requiredPreload) if (!preload.includes(token)) fail('contrôle export institutionnel absent: ' + token, 6);
}

console.log('SEB EvalPro Build #140: export Word historique institutionnel conservé; routage final 0.3.8 = Documents\\SEB EvalPro + archive interne candidat; JSON historiques inchangés.');
