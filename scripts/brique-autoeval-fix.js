const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'app', 'web', 'brique.html');

if (!fs.existsSync(target)) {
  console.error('SEB EvalPro: brique.html généré introuvable pour la correction autoévaluation.');
  process.exit(2);
}

let html = fs.readFileSync(target, 'utf8');

// Les cinq cases portent toutes name="auto". Le code historique enregistrait cb.name,
// ce qui produisait ["auto", "auto", ...] et empêchait le récapitulatif d'identifier
// les affirmations réellement cochées. Les valeurs ease_br, difficulties_br, etc.
// sont celles attendues par la page de résultats.
const oldSerializer = '.map(cb => cb.name);';
const newSerializer = '.map(cb => cb.value);';

if (html.includes(oldSerializer)) {
  html = html.replace(oldSerializer, newSerializer);
} else if (!html.includes(newSerializer)) {
  console.error('SEB EvalPro: sérialisation de l’autoévaluation Brique introuvable.');
  process.exit(3);
}

// Les labels doivent pointer vers les vrais id des cases pour que cliquer sur le texte
// coche exactement la case correspondante.
const labelFixes = [
  ['for="ease"', 'for="ease_br"'],
  ['for="difficulties"', 'for="difficulties_br"'],
  ['for="progress"', 'for="progress_br"'],
  ['for="motivation"', 'for="motivation_br"'],
  ['for="stress"', 'for="stress_br"']
];
for (const [from, to] of labelFixes) {
  html = html.split(from).join(to);
}

// Persister immédiatement l'autoévaluation avant la navigation vers stock.html.
const saveLine = 'sessionStorage.setItem("eval_brique_auto", JSON.stringify(autoEvalData));';
const persistedSave = `${saveLine}\n  if (window.sebEvalPro?.save) window.sebEvalPro.save();`;
if (html.includes(saveLine) && !html.includes(persistedSave)) {
  html = html.replace(saveLine, persistedSave);
}

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: autoévaluation Brique corrigée (valeurs, labels et persistance immédiate).');
