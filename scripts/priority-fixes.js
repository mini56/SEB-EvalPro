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
// 1 + 6 : page finale candidat DOCX réel + comparaison tolérante des heures.
// -----------------------------------------------------------------------------
{
  const { target, text } = read('app/web/qcmv1.0.html');
  let out = text;

  if (!out.includes('id="seb-result-docx-lib"')) {
    out = replaceOnce(
      out,
      '</head>',
      '<script src="js/docx.js" id="seb-result-docx-lib"></script>\n</head>',
      'chargement bibliothèque DOCX résultats'
    );
  }

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

  if (!out.includes('async function sauvegarderResultatStagiaireDocx')) {
    const saveFn = `\nasync function sauvegarderResultatStagiaireDocx() {\n  try {\n    if (!window.docx || !window.docx.Document || !window.docx.Packer) {\n      console.warn('SEB EvalPro : bibliothèque DOCX indisponible pour le résultat stagiaire.');\n      return;\n    }\n    const resultat = document.getElementById('resultat');\n    if (!resultat || !resultat.innerText.trim()) return;\n    const candidat = JSON.parse(sessionStorage.getItem('candidat_data') || '{}');\n    const safePart = (value, upper) => {\n      let s = String(value || '').trim();\n      try { s = s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); } catch (_) {}\n      s = s.replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '') || 'CANDIDAT';\n      return upper ? s.toUpperCase() : s;\n    };\n    const nom = safePart(candidat.nom, true);\n    const prenom = safePart(candidat['prénom'] || candidat.prenom, false);\n    const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(candidat.date || candidat.dateTest || ''))\n      ? String(candidat.date || candidat.dateTest)\n      : new Date().toISOString().slice(0, 10);\n    const filename = nom + '_' + prenom + '_' + date + '.docx';\n    const { Document, Packer, Paragraph, TextRun } = window.docx;\n    const lines = resultat.innerText.replace(/\\r/g, '').split('\\n');\n    const children = [\n      new Paragraph({ children: [new TextRun({ text: 'Résultats de l’évaluation SEB EvalPro', bold: true, size: 28 })] }),\n      new Paragraph({ text: '' })\n    ];\n    lines.forEach((line) => {\n      children.push(new Paragraph({ children: [new TextRun({ text: line || ' ', size: 20 })] }));\n    });\n    const documentWord = new Document({\n      sections: [{\n        properties: {\n          page: {\n            size: { width: 11906, height: 16838 },\n            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }\n          }\n        },\n        children\n      }]\n    });\n    const blob = await Packer.toBlob(documentWord);\n    const url = URL.createObjectURL(blob);\n    const link = document.createElement('a');\n    link.href = url;\n    link.download = filename;\n    link.style.display = 'none';\n    document.body.appendChild(link);\n    link.click();\n    link.remove();\n    setTimeout(() => URL.revokeObjectURL(url), 3000);\n    console.log('SEB EvalPro : résultat stagiaire enregistré automatiquement :', filename);\n  } catch (error) {\n    console.error('SEB EvalPro : échec enregistrement résultat stagiaire DOCX', error);\n  }\n}\n\n`;
    out = insertBefore(out, 'function afficherResultat() {', saveFn, 'fonction sauvegarde résultat stagiaire');
  }

  out = replaceOnce(
    out,
    "} catch (e) {\n    console.warn(\"Erreur tri de chevilles :\", e);\n}\n\n}\n/*-------------------------------------------------------------------------------------------------------------------------------*/",
    "} catch (e) {\n    console.warn(\"Erreur tri de chevilles :\", e);\n}\n\n  // Le résultat complet visible par le stagiaire est archivé automatiquement en DOCX.\n  setTimeout(() => sauvegarderResultatStagiaireDocx(), 150);\n}\n/*-------------------------------------------------------------------------------------------------------------------------------*/",
    'déclenchement sauvegarde résultat final'
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
    [qcm.includes('sauvegarderResultatStagiaireDocx') && qcm.includes("Packer.toBlob"), 'DOCX résultat stagiaire'],
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

console.log('SEB EvalPro priorités: résultats stagiaires DOCX + accès admin, bilan Word portrait sans répétition/PDF, stock, orthographe et heures corrigés.');
