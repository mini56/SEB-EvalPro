const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'app', 'web', 'qcmv1.0.html');
const modulePath = path.join(root, 'app', 'web', 'js', 'qcm-final-page.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro résultats candidat: ' + message);
  process.exit(code);
}

if (!fs.existsSync(target)) fail('qcmv1.0.html généré introuvable');
if (!fs.existsSync(modulePath)) fail('module qcm-final-page.js introuvable', 3);

let html = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');

// Compatibilité avec une ancienne source : supprimer encore le bloc historique si présent.
const finalActions = /(<div\s+id=["']pageFinale["'][^>]*>[\s\S]*?<div\s+id=["']resultat["'][^>]*><\/div>)\s*<div\s+style=["']margin-top:\s*12px;["']>\s*(?:<button\b[\s\S]*?<\/button>\s*)*<\/div>/i;
if (finalActions.test(html)) html = html.replace(finalActions, '$1');

// Supprimer d'éventuelles injections historiques si un ancien artefact est repris.
html = html.replace(
  /\s*<script\s+id=["']seb-candidate-results-admin-only["'][^>]*>[\s\S]*?<\/script>\s*/i,
  '\n'
);

if (!html.includes('<script src="js/qcm-final-page.js"></script>')) {
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('balise </body> introuvable', 4);
  html = html.slice(0, bodyEnd) + '\n<script src="js/qcm-final-page.js"></script>\n' + html.slice(bodyEnd);
}

const finalStart = html.search(/<div\s+id=["']pageFinale["']/i);
const bilanStart = finalStart >= 0 ? html.search(/<div\s+id=["']bilanPage["']/i) : -1;
const finalSlice = finalStart >= 0
  ? html.slice(finalStart, bilanStart > finalStart ? bilanStart : finalStart + 5000)
  : '';

for (const marker of [
  'window.print()',
  'savePDF()',
  "nextPage('bilanPage')",
  'goHome()'
]) {
  if (finalSlice.includes(marker)) fail('action candidat encore présente sur pageFinale: ' + marker, 5);
}

for (const token of [
  "const END_MESSAGE_ID = 'seb-candidate-end-message';",
  'function isAdminUnlocked()',
  'function ensureEndMessage()',
  'function applyFinalAccess()',
  "heading.textContent = admin ? 'Résultats du test' : 'Fin de l’évaluation';",
  'window.sebQcmFinal = Object.freeze({'
]) {
  if (!moduleText.includes(token)) fail('contrat pageFinale modulaire absent: ' + token, 6);
}

if (/seb-candidate-results-admin-only/.test(html)) {
  fail('ancien script inline de protection résultats encore présent', 7);
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: page finale candidat modulaire; actions admin retirées et résultats protégés par qcm-final-page.js.');
