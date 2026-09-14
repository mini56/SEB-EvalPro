const fs = require('fs');
const path = require('path');
const Module = require('module');

const target = path.join(__dirname, 'build135-audit-fixes.js');
let code = fs.readFileSync(target, 'utf8');

const oldOld = '  const oldPattern = "/^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}\\\\.docx$/i";';
const newOld = '  const oldPattern = "/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}\\\\.docx$/i";';
const oldNew = '  const newPattern = "/^[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}(?:_\\\\d+)?\\\\.docx$/i";';
const newNew = '  const newPattern = "/^Resultat_[A-Za-z0-9-]+_[A-Za-z0-9-]+_\\\\d{4}-\\\\d{2}-\\\\d{2}(?:_\\\\d+)?\\\\.docx$/i";';

if (!code.includes(oldOld) || !code.includes(oldNew)) {
  console.error('SEB EvalPro Build #135 runner: motifs Resultat_ à corriger introuvables.');
  process.exit(2);
}

code = code.replace(oldOld, newOld).replace(oldNew, newNew);

const runtime = new Module(target, module);
runtime.filename = target;
runtime.paths = module.paths.slice();
runtime._compile(code, target);

// Build #135 hotfix : lorsqu'un ancien bilan est modifié et qu'une nouvelle
// révision est enregistrée, produire immédiatement le document Word utilisable.
// Le JSON reste l'archive éditable interne ; le Word est déposé par le routage
// Electron dans Documents\\SEB EvalPro\\Bilans.
const preloadPath = path.join(__dirname, '..', 'src', 'bilan-history-preload.js');
let preload = fs.readFileSync(preloadPath, 'utf8').replace(/\r\n/g, '\n');

function replaceExact(search, replacement, label) {
  if (!preload.includes(search)) {
    console.error(`SEB EvalPro Build #135 Word historique: cible introuvable pour ${label}.`);
    process.exit(3);
  }
  preload = preload.replace(search, replacement);
}

replaceExact(
  '  let currentFilename = filename;\n',
  '  let currentFilename = filename;\n  let currentRevision = Number(archive.revision || 0);\n',
  'suivi de révision courante'
);

replaceExact(
`    if (result && result.ok) {
      currentFilename = result.filename || currentFilename;
      info.textContent = result.unchanged ? \`Aucune modification : révision \${result.revision} inchangée.\` : \`Révision \${result.revision} enregistrée. L'ancienne version est conservée.\`;
    } else info.textContent = \`Erreur : \${(result && result.error) || 'enregistrement impossible'}\`;
`,
`    if (result && result.ok) {
      currentFilename = result.filename || currentFilename;
      currentRevision = Number.isFinite(Number(result.revision)) ? Number(result.revision) : currentRevision;
      if (result.unchanged) {
        info.textContent = \`Aucune modification : révision \${result.revision} inchangée.\`;
      } else {
        const wordFilename = exportHistoricalWord(card, candidate, archive.originalBuild, currentRevision);
        info.textContent = \`Révision \${result.revision} enregistrée. Word créé automatiquement : \${wordFilename} dans Documents\\\\SEB EvalPro\\\\Bilans. L'ancienne version est conservée.\`;
      }
    } else info.textContent = \`Erreur : \${(result && result.error) || 'enregistrement impossible'}\`;
`,
  'export Word automatique après nouvelle révision'
);

replaceExact(
  "  overlay.querySelector('#seb-bh-export').addEventListener('click', () => exportHistoricalWord(card, candidate, archive.originalBuild));\n",
  "  overlay.querySelector('#seb-bh-export').addEventListener('click', () => {\n    const info = overlay.querySelector('#seb-bh-editor-info');\n    const wordFilename = exportHistoricalWord(card, candidate, archive.originalBuild, currentRevision);\n    if (info) info.textContent = `Word créé : ${wordFilename} dans Documents\\\\SEB EvalPro\\\\Bilans.`;\n  });\n",
  'bouton export Word'
);

replaceExact(
  'function exportHistoricalWord(card, candidate, originalBuild) {\n',
  'function exportHistoricalWord(card, candidate, originalBuild, revision) {\n',
  'signature export Word historique'
);

// Build #138 : les lettres NE/I/II/III restent uniquement dans la première
// ligne d'en-tête. Dans les lignes de résultat, la case sélectionnée est
// uniquement colorée et reste vide, comme dans le bilan institutionnel.
// Le format JSON historique n'est pas modifié : compatibilité #134+ conservée.
replaceExact(
  "    const levels = ['NE','I','II','III'].map((level) => `<td style=\"text-align:center;font-weight:bold\">${row.level === level ? level : ''}</td>`).join('');\n",
  "    const levelColors = { NE:'#ccffff', I:'#92d050', II:'#ed7d31', III:'#c00000' };\n    const levels = ['NE','I','II','III'].map((level) => {\n      const selected = row.level === level;\n      const background = selected ? levelColors[level] : '#ffffff';\n      return `<td style=\"text-align:center;background:${background};vertical-align:middle\"></td>`;\n    }).join('');\n",
  'cases NE/I/II/III colorées mais vides dans le Word historique'
);

replaceExact(
  "  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Calibri,Arial,sans-serif;font-size:10pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:5px;vertical-align:top}th{background:#0070c0;color:#fff}</style></head><body><h2>Bilan institutionnel</h2><p><b>Nom :</b> ${escapeHtml(candidate.nom || '')} &nbsp; <b>Prénom :</b> ${escapeHtml(candidate.prenom || '')} &nbsp; <b>Date :</b> ${escapeHtml(candidate.date || '')} &nbsp; <b>Build d'origine :</b> #${escapeHtml(originalBuild || '?')}</p><table><thead><tr><th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;\n",
  "  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><style>@page{size:A4 landscape;margin:10mm}body{font-family:Calibri,Arial,sans-serif;font-size:10pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:5px;vertical-align:top}th{background:#0070c0;color:#fff}th:nth-child(2){background:#ccffff;color:#000}th:nth-child(3){background:#92d050;color:#000}th:nth-child(4){background:#ed7d31;color:#fff}th:nth-child(5){background:#c00000;color:#fff}</style></head><body><h2>Bilan institutionnel</h2><p><b>Nom :</b> ${escapeHtml(candidate.nom || '')} &nbsp; <b>Prénom :</b> ${escapeHtml(candidate.prenom || '')} &nbsp; <b>Date :</b> ${escapeHtml(candidate.date || '')} &nbsp; <b>Build d'origine :</b> #${escapeHtml(originalBuild || '?')}</p><table><thead><tr><th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;\n",
  'couleurs des en-têtes NE/I/II/III du Word historique'
);

replaceExact(
  "  a.href = url; a.download = `Bilan_${safe(candidate.nom || 'NOM')}_${safe(candidate.prenom || 'PRENOM')}_${safe(candidate.date || '')}.doc`;\n  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);\n",
  "  const revisionNumber = Number.isFinite(Number(revision)) ? Number(revision) : 0;\n  const revisionSuffix = `_R${String(revisionNumber).padStart(2, '0')}`;\n  const wordFilename = `Bilan_${safe(candidate.nom || 'NOM')}_${safe(candidate.prenom || 'PRENOM')}_${safe(candidate.date || '')}${revisionSuffix}.doc`;\n  a.href = url; a.download = wordFilename;\n  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);\n  return wordFilename;\n",
  'nom Word avec numéro de révision'
);

for (const required of [
  'let currentRevision = Number(archive.revision || 0);',
  'Word créé automatiquement',
  'exportHistoricalWord(card, candidate, archive.originalBuild, currentRevision)',
  'const revisionSuffix = `_R${String(revisionNumber).padStart(2, \'0\')}`;',
  "const levelColors = { NE:'#ccffff', I:'#92d050', II:'#ed7d31', III:'#c00000' };",
  'background:${background};vertical-align:middle\"></td>',
  '<th>Modules</th><th>NE</th><th>I</th><th>II</th><th>III</th><th>Commentaires</th>',
  'return wordFilename;'
]) {
  if (!preload.includes(required)) {
    console.error(`SEB EvalPro Build #138 Word historique: contrôle final absent: ${required}`);
    process.exit(4);
  }
}

fs.writeFileSync(preloadPath, preload, 'utf8');
console.log('SEB EvalPro Build #138: Word historique corrigé — NE/I/II/III uniquement en en-tête; cases de résultat vides et seulement colorées; archives JSON #134+ inchangées.');
