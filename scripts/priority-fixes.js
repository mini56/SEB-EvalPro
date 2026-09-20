const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro priorités: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) fail(`fichier introuvable: ${relativePath}`);
  return { target, text: fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') };
}

function write(target, text) {
  fs.writeFileSync(target, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  const found = typeof search === 'string' ? text.includes(search) : search.test(text);
  if (!found) fail(`cible introuvable pour ${label}`, 3);
  if (search instanceof RegExp) search.lastIndex = 0;
  return text.replace(search, replacement);
}

function insertBefore(text, marker, addition, label) {
  const index = text.indexOf(marker);
  if (index < 0) fail(`point d'insertion introuvable pour ${label}`, 4);
  return text.slice(0, index) + addition + text.slice(index);
}

// -----------------------------------------------------------------------------
// 1 + 5 : Electron - stockage DOCX candidat, accès administrateur, orthographe.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('src/main.js');
  let out = text;
  if (!out.includes('// SEB_PRIORITY_FIXES_MAIN')) {
    out = replaceOnce(
      out,
      /const \{([^}]+)\} = require\('electron'\);/,
      (all, names) => {
        const parts = names.split(',').map((value) => value.trim()).filter(Boolean);
        if (!parts.includes('shell')) parts.push('shell');
        return "const { " + parts.join(', ') + " } = require('electron');\n// SEB_PRIORITY_FIXES_MAIN";
      },
      'import shell Electron'
    );

    if (!out.includes("const candidateExportDir = getCandidateStore().getActiveExportDir();")) {
      out = replaceOnce(
        out,
        "    const filename = path.basename(item.getFilename() || 'Evaluation.doc');\n    if (!/\\.docx?$/i.test(filename)) return;\n    try {\n      ensureSebDocumentsFolders();\n      item.setSavePath(uniqueOutputPath(bilanDocumentsDir(), filename));\n    } catch (_) {}",
        `    const filename = path.basename(item.getFilename() || 'Evaluation.doc');\n    if (!/\\.docx?$/i.test(filename)) return;\n    try {\n      ensureSebDocumentsFolders();\n      const isCandidateResult = /^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\d{4}-\\d{2}-\\d{2}\\.docx$/i.test(filename);\n      item.setSavePath(isCandidateResult\n        ? path.join(bilanDocumentsDir(), filename)\n        : uniqueOutputPath(bilanDocumentsDir(), filename));\n    } catch (_) {}`,
        'routage résultats candidats'
      );
    }

    if (!out.includes('spellcheck: false')) {
      if (out.includes("      sandbox: false,\n")) {
        out = replaceOnce(
          out,
          "      sandbox: false,\n",
          "      sandbox: false,\n      spellcheck: false,\n",
          'désactivation orthographe Electron avec protections supplémentaires'
        );
      } else {
        out = replaceOnce(
          out,
          "      sandbox: false\n    }",
          "      sandbox: false,\n      spellcheck: false\n    }",
          'désactivation orthographe Electron'
        );
      }
    }

    if (!out.includes("admin:open-candidate-results")) {
      fail('flux Résultats candidat par dossier absent de main.js', 5);
    }
  }
  write(target, out);
}

{
  const { target, text } = read('src/preload.js');
  let out = text;
  if (!out.includes('// SEB_PRIORITY_FIXES_PRELOAD')) {
    out = replaceOnce(
      out,
      "const BAR_HEIGHT = 44;",
      "const BAR_HEIGHT = 44;\n// SEB_PRIORITY_FIXES_PRELOAD",
      'marqueur preload'
    );

    const hasCandidateFolderResults = out.includes("candidate-catalog:results-workspace-load-sync") && out.includes("adminCandidateResultsWorkspace");
    if (!hasCandidateFolderResults) {
      fail('flux Résultats candidat par dossier absent de preload.js', 5);
    }

    out = replaceOnce(
      out,
      "window.addEventListener('DOMContentLoaded', async () => {\n  adminUnlocked = await ipcRenderer.invoke('admin:status');",
      "window.addEventListener('DOMContentLoaded', async () => {\n  document.documentElement.setAttribute('spellcheck', 'false');\n  document.querySelectorAll('input, textarea, [contenteditable]').forEach((el) => {\n    el.setAttribute('spellcheck', 'false');\n    el.setAttribute('autocorrect', 'off');\n    el.setAttribute('autocapitalize', 'off');\n  });\n  adminUnlocked = await ipcRenderer.invoke('admin:status');",
      'désactivation orthographe DOM'
    );
  }
  write(target, out);
}

// -----------------------------------------------------------------------------
// Page 3 : comparaison tolérante des heures.
// L'ancien DOCX automatique "Resultat_..." est retiré : la vraie page Résultats
// est désormais disponible en lecture seule depuis le dossier candidat.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/qcmv1.0.html');
  let out = text;

  if (!out.includes('function normalizeSebTime')) {
    const helper = `\nfunction normalizeSebTime(value) {\n  let s = String(value || '').trim().toLowerCase();\n  if (!s) return '';\n  try { s = s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); } catch (_) {}\n  s = s.replace(/heures?/g, 'h').replace(/heurs?/g, 'h').replace(/hrs?/g, 'h');\n  s = s.replace(/minutes?/g, '').replace(/mins?/g, '').replace(/mn/g, '');\n  s = s.replace(/\\s+/g, ' ').trim();\n  let match = s.match(/^(\\d{1,2})\\s*(?:h|:)\\s*(\\d{1,2})\\s*$/);\n  if (!match) match = s.match(/^(\\d{1,2})\\s+(\\d{1,2})\\s*$/);\n  if (!match) return s.replace(/\\s+/g, '');\n  const h = Number(match[1]), m = Number(match[2]);\n  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';\n  return String(h) + 'h' + String(m).padStart(2, '0');\n}\n\n`;
    out = insertBefore(out, 'function saveTableAnswers(pageNum)', helper, 'normalisation des heures');
  }

  out = replaceOnce(
    out,
    "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && val.toString().toUpperCase() === bonnes[i].toString().toUpperCase())\n        ? 1 : 0;",
    "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()))\n        ? 1 : 0;",
    'comparaison heures page 3'
  );

  write(target, out);
}

// -----------------------------------------------------------------------------
// 4 : le flacon exemple du stock est pédagogique et ne compte jamais au score.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/stock.html');
  let out = text;
  out = replaceOnce(
    out,
    "            if (examplePot && targetCase) {\n                targetCase.appendChild(examplePot);",
    "            if (examplePot && targetCase) {\n                examplePot.dataset.sebExample = 'true';\n                targetCase.appendChild(examplePot);",
    'marquage flacon exemple'
  );
  out = replaceOnce(
    out,
    "    document.querySelectorAll('.pot').forEach(pot => {",
    "    document.querySelectorAll('.pot:not([data-seb-example=\"true\"])').forEach(pot => {",
    'exclusion exemple du score stock'
  );
  out = out.replace(/\$\{correctCount\} \/ 34/g, '${correctCount} / 33');
  out = out.replace('sessionStorage.setItem("stockTotal", 34);', 'sessionStorage.setItem("stockTotal", 33);');
  if (!out.includes('stockTotal", 33')) fail('stockTotal 33 absent après correction', 5);
  write(target, out);
}

// -----------------------------------------------------------------------------
// 2 + 3 : bilan Word portrait, en-tête non répété, suppression totale du PDF.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/admin-bilan.html');
  let out = text;
  out = out.replace('@page{size:A4 landscape;margin:10mm}', '@page{size:A4 portrait;margin:10mm}');
  out = out.replace(';thead{display:table-row-group}', ';thead{display:table-row-group}');
  out = out.replace('<button id="pdf">Exporter PDF</button>', '');
  out = out.replace('size:841.95pt 595.35pt;mso-page-orientation:landscape;margin:28pt', 'size:595.35pt 841.95pt;mso-page-orientation:portrait;margin:28pt');

  out = replaceOnce(
    out,
    "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);prepareWordColours(t);",
    "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);prepareWordColours(t);const wh=t.querySelector('thead');if(wh){const wb=document.createElement('tbody');while(wh.firstChild)wb.appendChild(wh.firstChild);wh.replaceWith(wb)}",
    'en-tête tableau Word non répétable'
  );

  out = out.replace(/function pdf\(\)\{save\(\);document\.title=base\(\);status\('Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression'\);setTimeout\(\(\)=>print\(\),50\)\}\n?/, '');
  out = out.replace(";$('#pdf').onclick=pdf", '');

  if (out.includes('id="pdf"') || out.includes("$('#pdf').onclick=pdf") || out.includes('function pdf()')) {
    fail('fonction PDF encore présente dans le bilan administrateur', 6);
  }
  if (out.includes('mso-page-orientation:landscape')) fail('export Word encore en paysage', 7);
  write(target, out);
}

// -----------------------------------------------------------------------------
// 5 : neutralisation explicite du correcteur dans Quill et la page générée.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/nwtexte.html');
  let out = text.replace(/spellcheck="true"/g, 'spellcheck="false"');
  write(target, out);
}

{
  const { target, text } = read('app/web/js/nwtexte-quill-engine.js');
  let out = text.replace("quill.root.setAttribute('spellcheck', 'true');", "quill.root.setAttribute('spellcheck', 'false');");
  write(target, out);
}

// Contrôles finaux bloquants.
{
  const main = read('src/main.js').text;
  const preload = read('src/preload.js').text;
  const qcm = read('app/web/qcmv1.0.html').text;
  const stock = read('app/web/stock.html').text;
  const bilan = read('app/web/admin-bilan.html').text;
  const nw = read('app/web/nwtexte.html').text;
  const engine = read('app/web/js/nwtexte-quill-engine.js').text;

  const checks = [
    [main.includes('spellcheck: false'), 'spellcheck Electron'],
    [main.includes("admin:open-candidate-results"), 'accès admin résultats candidat'],
    [preload.includes('adminCandidateResultsWorkspace') && preload.includes('showReadOnlyCandidateResults'), 'accès résultats candidat Admin'],
    [qcm.includes('normalizeSebTime(val) === normalizeSebTime(bonnes[i])'), 'normalisation heures page 3'],
    [stock.includes('data-seb-example') || stock.includes('sebExample'), 'marquage exemple stock'],
    [stock.includes('stockTotal", 33'), 'total stock 33'],
    [bilan.includes('mso-page-orientation:portrait'), 'Word portrait'],
    [!bilan.includes('id="pdf"'), 'PDF supprimé'],
    [nw.includes('spellcheck="false"'), 'nwtexte sans spellcheck'],
    [engine.includes("quill.root.setAttribute('spellcheck', 'false')"), 'Quill sans spellcheck']
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
  if (failed.length) fail(`contrôles finaux échoués: ${failed.join(', ')}`, 8);
}

console.log('SEB EvalPro priorités: Résultats par dossier candidat, bilan Word portrait sans PDF, stock, orthographe et heures corrigés.');
