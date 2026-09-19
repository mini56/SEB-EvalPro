const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'tri_de_cheville.html');

function fail(message, code = 2) {
  console.error(`SEB EvalPro tri résultats: ${message}`);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('page tri_de_cheville.html introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Les erreurs doivent rester vides tant que le stagiaire ne les a pas renseignées.
// Une valeur 0 est donc distinguée d'une absence de saisie.
const oldErrorPersist = `      const erreurs = integerValue('e' + i);\n      tris.push({ minutes: String(minutes), secondes: String(secondes), erreurs: String(erreurs) });`;
const newErrorPersist = `      const errorInput = document.getElementById('e' + i);\n      const errorRaw = errorInput ? String(errorInput.value == null ? '' : errorInput.value).trim() : '';\n      const parsedError = errorRaw === '' ? null : Number(errorRaw);\n      const erreurs = Number.isInteger(parsedError) && parsedError >= 0 ? parsedError : null;\n      tris.push({ minutes: String(minutes), secondes: String(secondes), erreurs: erreurs === null ? '' : String(erreurs) });`;
if (!html.includes(oldErrorPersist)) fail('persistance des erreurs du tri introuvable', 3);
html = html.replace(oldErrorPersist, newErrorPersist);

if (!html.includes('      totalErreurs += erreurs;')) fail('total des erreurs du tri introuvable', 4);
html = html.replace('      totalErreurs += erreurs;', '      if (erreurs !== null) totalErreurs += erreurs;');

// Le tri suivant ne doit pas pouvoir démarrer si le nombre d'erreurs du tri précédent
// n'a pas été explicitement saisi, même lorsque ce nombre vaut zéro.
const updateMarker = `  function updateTriState(){\n    const validate = document.getElementById('resetBtn');`;
if (!html.includes(updateMarker)) fail('fonction updateTriState introuvable', 5);
html = html.replace(updateMarker, `  function hasExplicitError(index){\n    if (index < 1 || index > 5) return true;\n    const input = document.getElementById('e' + index);\n    if (!input) return false;\n    const raw = String(input.value == null ? '' : input.value).trim();\n    if (raw === '') return false;\n    const value = Number(raw);\n    return Number.isInteger(value) && value >= 0;\n  }\n\n  function updateTriState(){\n    const validate = document.getElementById('resetBtn');`);

const oldStartState = `      validate.textContent = 'Valider le tri';\n      validate.disabled = !triStarted;\n      if (start) start.disabled = false;`;
const newStartState = `      validate.textContent = 'Valider le tri';\n      validate.disabled = !triStarted;\n      const previousTriNeedsErrors = !triStarted && currentTri > 1 && currentTri <= 5 && !hasExplicitError(currentTri - 1);\n      if (start) start.disabled = previousTriNeedsErrors;`;
if (!html.includes(oldStartState)) fail('état du bouton Démarrer introuvable', 6);
html = html.replace(oldStartState, newStartState);

const oldStartListener = `    const startButton = document.getElementById('startBtn');\n    if (startButton) startButton.addEventListener('click', function(){\n      triStarted = true;\n      updateTriState();\n    });`;
const newStartListener = `    const startButton = document.getElementById('startBtn');\n    if (startButton) startButton.addEventListener('click', function(event){\n      const previousTri = currentTri - 1;\n      if (previousTri >= 1 && previousTri <= 5 && !hasExplicitError(previousTri)) {\n        event.preventDefault();\n        event.stopImmediatePropagation();\n        const errorInput = document.getElementById('e' + previousTri);\n        window.alert('Renseignez le nombre d’erreurs du tri ' + previousTri + ' avant de démarrer le tri suivant. Saisissez 0 si aucune erreur n’a été commise.');\n        if (errorInput) setTimeout(function(){ errorInput.focus(); }, 0);\n        updateTriState();\n        return;\n      }\n      triStarted = true;\n      updateTriState();\n    }, true);\n\n    for (let i = 1; i <= 5; i += 1) {\n      const errorInput = document.getElementById('e' + i);\n      if (!errorInput) continue;\n      const refreshErrorState = function(){\n        updateTriState();\n        if (hasExplicitError(i)) computeAndPersist();\n      };\n      errorInput.addEventListener('input', refreshErrorState);\n      errorInput.addEventListener('change', refreshErrorState);\n    }`;
if (!html.includes(oldStartListener)) fail('contrôle du bouton Démarrer introuvable', 7);
html = html.replace(oldStartListener, newStartListener);

// Consignes alignées sur le fonctionnement actuel : le temps est repris automatiquement
// au clic sur « Valider le tri » et les résultats sont disponibles dès 3 tris complets (jusqu’à 5).
const consigneRegex = /(<div id="consigne">[\s\S]*?<ul>)[\s\S]*?(<\/ul>)/;
if (!consigneRegex.test(html)) fail('bloc de consignes introuvable', 8);
html = html.replace(consigneRegex, `$1
            <li>Pour chaque boîte de chevilles, cliquez sur <strong>Démarrer</strong> au moment où vous commencez le tri.</li>
            <li>Lorsque le tri est terminé, cliquez sur <strong>Valider le tri</strong>. Votre temps est enregistré automatiquement. Renseignez ensuite le <strong>nombre d’erreurs</strong> correspondant au tri effectué, même s’il est égal à <strong>0</strong>.</li>
            <li>Le tri suivant ne peut pas démarrer tant que le nombre d’erreurs du tri précédent n’a pas été renseigné.</li>
            <li>Effectuez entre <strong>3 et 5 tris</strong> selon le temps disponible pour le plateau.</li>
            <li>À partir de 3 tris complets, avec le nombre d’erreurs renseigné pour chacun, cliquez sur <strong>Voir les résultats</strong> pour afficher votre moyenne, le nombre total d’erreurs et compléter votre autoévaluation personnelle.</li>
          $2`);

const calcRegex = /<button id="calc" type="button" onclick="calcMoyenne\(\);?">Calculer<\/button>/;
if (!calcRegex.test(html)) fail('bouton Calculer introuvable', 9);
html = html.replace(calcRegex, '<button id="calc" type="button" onclick="sebEvalProShowTriResults()" disabled>Voir les résultats</button>');

if (!html.includes('id="seb-tri-results-visibility"')) {
  const style = `
<style id="seb-tri-results-visibility">
.wrapper { max-width: 1350px; padding: 14px 16px; gap: 12px; }
.header { padding: 12px 16px; }
#left, #right { padding: 12px; gap: 10px; }
#right .results-container { display: none; }
#calc:disabled { opacity: .55; cursor: not-allowed; }
</style>
`;
  if (!html.includes('</head>')) fail('balise </head> introuvable', 10);
  html = html.replace('</head>', style + '</head>');
}

if (!html.includes('id="seb-tri-results-flow"')) {
  const script = `
<script id="seb-tri-results-flow">
(function(){
  function explicitError(index){
    const input = document.getElementById('e' + index);
    if (!input) return false;
    const raw = String(input.value == null ? '' : input.value).trim();
    if (raw === '') return false;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0;
  }

  function fiveTrisDone(){
    let completed = 0;
    for (let i = 1; i <= 5; i += 1) {
      const m = document.getElementById('m' + i);
      const s = document.getElementById('s' + i);
      const e = document.getElementById('e' + i);
      if (!m || !s || !e) continue;
      const hasTime = String(m.value == null ? '' : m.value).trim() !== '' || String(s.value == null ? '' : s.value).trim() !== '';
      const hasError = String(e.value == null ? '' : e.value).trim() !== '';
      if (hasTime !== hasError) return false;
      if (hasTime) {
        if (!explicitError(i)) return false;
        completed += 1;
      }
    }
    return completed >= 3;
  }

  function resultsWereAlreadyShown(){
    const auto = document.getElementById('autoEvalPart');
    return !!(auto && (auto.classList.contains('visible') || auto.style.display === 'block'));
  }

  function refreshResultsButton(){
    const calc = document.getElementById('calc');
    if (!calc) return;
    calc.textContent = 'Voir les résultats';
    calc.disabled = !fiveTrisDone();
  }

  window.sebEvalProShowTriResults = function(){
    if (!fiveTrisDone()) {
      window.alert('Renseignez au moins 3 tris complets avec le temps et le nombre d’erreurs de chacun (0 si aucune erreur) avant d’afficher les résultats.');
      return;
    }

    if (typeof calcMoyenne === 'function') calcMoyenne();

    const results = document.querySelector('#right .results-container');
    if (results) results.style.display = 'flex';
    refreshResultsButton();
  };

  document.addEventListener('DOMContentLoaded', function(){
    const results = document.querySelector('#right .results-container');
    if (results) results.style.display = resultsWereAlreadyShown() && fiveTrisDone() ? 'flex' : 'none';

    refreshResultsButton();

    const validate = document.getElementById('resetBtn');
    if (validate) {
      validate.addEventListener('click', function(){ setTimeout(refreshResultsButton, 0); });
      new MutationObserver(refreshResultsButton).observe(validate, { childList: true, characterData: true, subtree: true, attributes: true });
    }

    for (let i = 1; i <= 5; i += 1) {
      ['m','s','e'].forEach(function(prefix){
        const input = document.getElementById(prefix + i);
        if (input) {
          input.addEventListener('input', refreshResultsButton);
          input.addEventListener('change', refreshResultsButton);
        }
      });
    }
  });
})();
</script>
`;
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail('balise </body> introuvable', 11);
  html = html.slice(0, index) + script + html.slice(index);
}

if (html.includes('>Calculer</button>')) fail('ancien libellé Calculer encore présent', 12);
if (!html.includes('Voir les résultats')) fail('nouveau bouton Voir les résultats absent', 13);
if (!html.includes('même s’il est égal à <strong>0</strong>')) fail('consigne de saisie explicite de zéro absente', 14);
if (!html.includes('Renseignez le nombre d’erreurs du tri')) fail('blocage du tri suivant sans erreurs absent', 15);
if (!html.includes('if (!explicitError(i)) return false;')) fail('résultats non protégés contre erreurs manquantes', 16);
if (!html.includes("erreurs: erreurs === null ? '' : String(erreurs)")) fail('distinction erreur vide / zéro absente', 17);
if (!html.includes('max-width: 1350px')) fail('élargissement de la page tri absent', 18);

fs.writeFileSync(file, html, 'utf8');

// QCM : rendre tous les boutons d'ouverture de la calculatrice aussi visibles que
// les boutons Suivant, avec l'orange clair institutionnel demandé.
const qcmFile = path.join(root, 'app', 'web', 'qcmv1.0.html');
if (!fs.existsSync(qcmFile)) fail('page qcmv1.0.html introuvable', 19);
let qcm = fs.readFileSync(qcmFile, 'utf8').replace(/\r\n/g, '\n');
if (!qcm.includes('window.openCalculator()')) fail('boutons calculatrice introuvables dans le QCM', 20);
if (!qcm.includes('id="seb-calculator-button-style"')) {
  const calcStyle = `
<style id="seb-calculator-button-style">
button[onclick="window.openCalculator()"] {
  background-color: #F9B233;
  color: #1e293b;
  border: none;
  padding: 12px 25px;
  font-size: 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}
button[onclick="window.openCalculator()"]:hover {
  background-color: #e9a11f;
}
</style>
`;
  if (!qcm.includes('</head>')) fail('balise </head> du QCM introuvable', 21);
  qcm = qcm.replace('</head>', calcStyle + '</head>');
}
if (!qcm.includes('background-color: #F9B233')) fail('style orange clair de la calculatrice absent', 22);
fs.writeFileSync(qcmFile, qcm, 'utf8');

console.log('SEB EvalPro tri résultats: erreurs explicites obligatoires (0 accepté), tri suivant bloqué si oubli, résultats différés conservés et bouton calculatrice orange clair renforcé.');
