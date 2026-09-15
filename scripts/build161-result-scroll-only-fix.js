const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #161 scroll/calculatrice: ' + message);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// La calculatrice ne doit jamais être repositionnée automatiquement quand la
// largeur utile du viewport change. Un changement de scrollbar déclenchait un
// resize Chromium, puis ce listener recalculait la position de la calculatrice.
const calculatorResizeBlock = `  window.addEventListener('resize', function(){
    if (container.dataset.sebPositioned !== '1') return;
    const rect = container.getBoundingClientRect();
    setPosition(rect.left, rect.top);
  });

`;
if (!html.includes(calculatorResizeBlock)) {
  fail('listener resize de la calculatrice introuvable; arrêt pour éviter une modification approximative', 3);
}
html = html.replace(calculatorResizeBlock, '');

const styleId = 'seb-result-scroll-only-style';
if (!html.includes(`id="${styleId}"`)) {
  const style = `
<style id="${styleId}">
/* Build #161 : aucune scrollbar de page pendant le parcours candidat.
   La page Résultats est l'unique page autorisée à défiler verticalement. */
html.seb-candidate-no-page-scroll,
html.seb-candidate-no-page-scroll body {
  height: 100% !important;
  overflow: hidden !important;
}
html.seb-results-page-scroll {
  height: 100% !important;
  overflow: hidden !important;
}
html.seb-results-page-scroll body {
  height: 100% !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
</style>
`;
  const headEnd = html.toLowerCase().indexOf('</head>');
  if (headEnd < 0) fail('balise </head> introuvable', 4);
  html = html.slice(0, headEnd) + style + html.slice(headEnd);
}

const policyScriptId = 'seb-result-scroll-only-script';
if (!html.includes(`id="${policyScriptId}"`)) {
  const policyCode = `(function(){
  const root = document.documentElement;
  let observer = null;

  function syncPageScrollPolicy() {
    const finalPage = document.getElementById('pageFinale');
    const resultsVisible = !!(finalPage && finalPage.classList.contains('visible'));
    root.classList.toggle('seb-results-page-scroll', resultsVisible);
    root.classList.toggle('seb-candidate-no-page-scroll', !resultsVisible);
  }

  function installPageScrollPolicy() {
    const finalPage = document.getElementById('pageFinale');
    syncPageScrollPolicy();
    if (!finalPage || observer) return;
    observer = new MutationObserver(syncPageScrollPolicy);
    observer.observe(finalPage, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPageScrollPolicy, { once: true });
  } else {
    installPageScrollPolicy();
  }
})();`;

  try { new vm.Script(policyCode); }
  catch (error) { fail('script de politique de scroll invalide: ' + error.message, 5); }

  const script = `\n<script id="${policyScriptId}">\n${policyCode}\n</script>\n`;
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  if (bodyEnd < 0) fail('balise </body> introuvable', 6);
  html = html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
}

for (const required of [
  'seb-candidate-no-page-scroll',
  'seb-results-page-scroll',
  "finalPage.classList.contains('visible')",
  "observer.observe(finalPage, { attributes: true, attributeFilter: ['class'] })",
  'overflow-y: auto !important;',
  'overflow: hidden !important;'
]) {
  if (!html.includes(required)) fail('contrôle final absent: ' + required, 7);
}

if (html.includes(calculatorResizeBlock.trim())) {
  fail('listener resize calculatrice encore présent', 8);
}

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro Build #161: scrollbar de page interdite pendant le parcours et autorisée uniquement sur Résultats; calculatrice non repositionnée sur resize.');
