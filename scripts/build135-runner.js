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
  'return wordFilename;'
]) {
  if (!preload.includes(required)) {
    console.error(`SEB EvalPro Build #135 Word historique: contrôle final absent: ${required}`);
    process.exit(4);
  }
}

fs.writeFileSync(preloadPath, preload, 'utf8');
console.log('SEB EvalPro Build #135 hotfix: toute nouvelle révision d’un ancien bilan crée aussi automatiquement son Word dans Documents\\SEB EvalPro\\Bilans.');
