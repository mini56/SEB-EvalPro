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

const modulePath = path.join(root, 'app', 'web', 'js', 'qcm-final-page.js');
if (!fs.existsSync(modulePath)) fail('module qcm-final-page.js introuvable', 5);
const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');

// Nettoyage d'un ancien runtime inline si un artefact historique est repris.
html = html.replace(
  /\s*<script\s+id=["']seb-result-scroll-only-script["'][^>]*>[\s\S]*?<\/script>\s*/i,
  '\n'
);

for (const token of [
  'function syncPageScrollPolicy()',
  "root.classList.toggle('seb-results-page-scroll', resultsVisible);",
  "root.classList.toggle('seb-candidate-no-page-scroll', !resultsVisible);",
  "pageObserver.observe(page, { attributes:true, attributeFilter:['class'] });"
]) {
  if (!moduleText.includes(token)) fail('politique de scroll modulaire absente: ' + token, 5);
}

for (const required of [
  'seb-candidate-no-page-scroll',
  'seb-results-page-scroll',
  'overflow-y: auto !important;',
  'overflow: hidden !important;'
]) {
  if (!html.includes(required)) fail('contrôle CSS final absent: ' + required, 7);
}
if (!html.includes('js/qcm-final-page.js')) fail('module pageFinale absent du QCM généré', 7);
if (/seb-result-scroll-only-script/.test(html)) fail('ancien runtime inline de scroll encore présent', 7);

if (html.includes(calculatorResizeBlock.trim())) {
  fail('listener resize calculatrice encore présent', 8);
}

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro Build #161: scrollbar de page interdite pendant le parcours et autorisée uniquement sur Résultats; calculatrice non repositionnée sur resize.');
