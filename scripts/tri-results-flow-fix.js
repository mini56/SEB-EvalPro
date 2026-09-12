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

// Consignes alignées sur le fonctionnement actuel : le temps est repris automatiquement
// au clic sur « Valider le tri » et les résultats ne sont révélés qu'après les 5 tris.
const consigneRegex = /(<div id="consigne">[\s\S]*?<ul>)[\s\S]*?(<\/ul>)/;
if (!consigneRegex.test(html)) fail('bloc de consignes introuvable', 3);
html = html.replace(consigneRegex, `$1
            <li>Pour chaque boîte de chevilles, cliquez sur <strong>Démarrer</strong> au moment où vous commencez le tri.</li>
            <li>Lorsque le tri est terminé, renseignez le <strong>nombre d’erreurs</strong>, puis cliquez sur <strong>Valider le tri</strong>. Votre temps est enregistré automatiquement.</li>
            <li>Répétez l’opération pour les <strong>5 boîtes de chevilles</strong>.</li>
            <li>Lorsque les 5 tris sont terminés, cliquez sur <strong>Voir les résultats</strong> pour afficher votre moyenne, le nombre total d’erreurs et compléter votre autoévaluation personnelle.</li>
          $2`);

const calcRegex = /<button id="calc" type="button" onclick="calcMoyenne\(\);?">Calculer<\/button>/;
if (!calcRegex.test(html)) fail('bouton Calculer introuvable', 4);
html = html.replace(calcRegex, '<button id="calc" type="button" onclick="sebEvalProShowTriResults()" disabled>Voir les résultats</button>');

if (!html.includes('id="seb-tri-results-visibility"')) {
  const style = `
<style id="seb-tri-results-visibility">
#right .results-container { display: none; }
#calc:disabled { opacity: .55; cursor: not-allowed; }
</style>
`;
  if (!html.includes('</head>')) fail('balise </head> introuvable', 5);
  html = html.replace('</head>', style + '</head>');
}

if (!html.includes('id="seb-tri-results-flow"')) {
  const script = `
<script id="seb-tri-results-flow">
(function(){
  function fiveTrisDone(){
    const validate = document.getElementById('resetBtn');
    if (validate && /5\\s+tris\\s+validés/i.test(validate.textContent || '')) return true;
    for (let i = 1; i <= 5; i += 1) {
      const m = document.getElementById('m' + i);
      const s = document.getElementById('s' + i);
      if (!m || !s) return false;
      if ((m.value === '' || m.value == null) && (s.value === '' || s.value == null)) return false;
    }
    return true;
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
      window.alert('Terminez et validez les 5 tris avant d’afficher les résultats.');
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
        if (input) input.addEventListener('change', refreshResultsButton);
      });
    }
  });
})();
</script>
`;
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail('balise </body> introuvable', 6);
  html = html.slice(0, index) + script + html.slice(index);
}

if (html.includes('>Calculer</button>')) fail('ancien libellé Calculer encore présent', 7);
if (!html.includes('Voir les résultats')) fail('nouveau bouton Voir les résultats absent', 8);
if (!html.includes('nombre total d’erreurs')) fail('nouvelle consigne résultats absente', 9);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro tri résultats: résultats masqués pendant les tris, bouton « Voir les résultats » après 5 validations, autoévaluation révélée au même moment.');
