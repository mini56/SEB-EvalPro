const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'app', 'web', 'qcmv1.0.html');
if (!fs.existsSync(target)) {
  console.error('SEB EvalPro: qcmv1.0.html généré introuvable pour le nettoyage nouvelle évaluation.');
  process.exit(20);
}

let html = fs.readFileSync(target, 'utf8');

const oldReset = `function clearPreviousBriqueAndTriForNewEvaluation(){
    EXERCISE_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
  }`;
const newReset = `function clearPreviousBriqueAndTriForNewEvaluation(){
    // Une nouvelle évaluation doit partir d'un état totalement vierge.
    sessionStorage.clear();
    localStorage.clear();
  }`;

if (!html.includes(oldReset)) {
  console.error('SEB EvalPro: fonction de nettoyage de nouvelle évaluation introuvable.');
  process.exit(21);
}
html = html.replace(oldReset, newReset);

const oldReturn = `return original.apply(this, arguments);`;
const newReturn = `const result = original.apply(this, arguments);
      // Le candidat vient d'être recréé par verifierNomLieu : persister immédiatement l'état propre.
      if (window.sebEvalPro?.save) window.sebEvalPro.save();
      return result;`;

if (!html.includes(oldReturn)) {
  console.error('SEB EvalPro: point de sauvegarde après démarrage d’une nouvelle évaluation introuvable.');
  process.exit(22);
}
html = html.replace(oldReturn, newReturn);

fs.writeFileSync(target, html, 'utf8');
console.log('SEB EvalPro: toute nouvelle évaluation efface intégralement les anciennes données candidat/exercices/bilan avant de démarrer.');
