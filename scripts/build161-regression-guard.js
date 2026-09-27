const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const qcmPath = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message) {
  console.error('SEB EvalPro Build #161 regression guard: ' + message);
  process.exit(2);
}

const qcm = fs.readFileSync(qcmPath, 'utf8').replace(/\r\n/g, '\n');
const finalModulePath = path.join(root, 'app', 'web', 'js', 'qcm-final-page.js');
if (!fs.existsSync(finalModulePath)) fail('module qcm-final-page.js introuvable');
const finalModule = fs.readFileSync(finalModulePath, 'utf8').replace(/\r\n/g, '\n');

for (const required of [
  'id="seb-result-scroll-only-style"',
  'html.seb-candidate-no-page-scroll',
  'html.seb-results-page-scroll body',
  'overflow-y: auto !important;',
  '<script src="js/qcm-final-page.js"></script>'
]) {
  if (!qcm.includes(required)) fail('règle QCM attendue absente: ' + required);
}

for (const required of [
  "const resultsVisible = isFinalVisible();",
  "root.classList.toggle('seb-candidate-no-page-scroll', !resultsVisible)",
  "root.classList.toggle('seb-results-page-scroll', resultsVisible)",
  "pageObserver.observe(page, { attributes:true, attributeFilter:['class'] });"
]) {
  if (!finalModule.includes(required)) fail('règle module pageFinale absente: ' + required);
}

if (qcm.includes('id="seb-result-scroll-only-script"')) {
  fail('ancien runtime inline de scroll encore présent');
}

const forbiddenCalculatorResize = `window.addEventListener('resize', function(){\n    if (container.dataset.sebPositioned !== '1') return;\n    const rect = container.getBoundingClientRect();\n    setPosition(rect.left, rect.top);`;
if (qcm.includes(forbiddenCalculatorResize)) {
  fail('la calculatrice se repositionne encore automatiquement sur resize');
}

for (const forbidden of [
  'scrollbar-gutter:stable',
  'window.scrollTo(0, window.scrollY)',
  'lockHorizontalPosition'
]) {
  if (qcm.includes(forbidden)) fail('ancienne mécanique de scroll interdite détectée: ' + forbidden);
}

console.log('SEB EvalPro Build #161 guard: scrollbar globale uniquement sur Résultats; aucun repositionnement automatique de la calculatrice; anciennes mécaniques de scroll absentes.');
