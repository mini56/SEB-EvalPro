const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'qcmv1.0.html');

if (!fs.existsSync(target)) {
  console.error('SEB EvalPro: qcmv1.0.html généré introuvable pour verrouiller la page de résultats candidat.');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8');

// À la fin du parcours, le candidat doit uniquement pouvoir consulter ses résultats.
// Les actions Impression / PDF / Bilan / Accueil restent réservées à l'environnement administrateur.
const finalActions = /(<div\s+id=["']pageFinale["'][^>]*>[\s\S]*?<div\s+id=["']resultat["'][^>]*><\/div>)\s*<div\s+style=["']margin-top:\s*12px;["']>\s*(?:<button\b[\s\S]*?<\/button>\s*)*<\/div>/i;

if (!finalActions.test(html)) {
  console.error('SEB EvalPro: bloc d’actions de la page de résultats candidat introuvable.');
  process.exit(3);
}

html = html.replace(finalActions, '$1');

const finalStart = html.search(/<div\s+id=["']pageFinale["']/i);
const nextPageStart = finalStart >= 0 ? html.indexOf('<!--', finalStart + 1) : -1;
const finalSlice = finalStart >= 0
  ? html.slice(finalStart, nextPageStart > finalStart ? nextPageStart : finalStart + 5000)
  : '';

const forbidden = [
  'window.print()',
  'savePDF()',
  "nextPage('bilanPage')",
  'goHome()'
];

for (const marker of forbidden) {
  if (finalSlice.includes(marker)) {
    console.error(`SEB EvalPro: action candidat encore présente sur la page finale : ${marker}`);
    process.exit(4);
  }
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: page finale candidat verrouillée en lecture seule (aucun bouton Impression/PDF/Bilan/Accueil).');
