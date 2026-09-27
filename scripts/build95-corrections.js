const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error(`SEB EvalPro corrections #95: ${message}`);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  const found = typeof search === 'string' ? text.includes(search) : search.test(text);
  if (!found) fail(`cible introuvable pour ${label}`, 3);
  if (search instanceof RegExp) search.lastIndex = 0;
  return text.replace(search, replacement);
}

function appendBeforeBody(text, addition, label) {
  const index = text.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail(`balise </body> introuvable pour ${label}`, 4);
  return text.slice(0, index) + addition + text.slice(index);
}

// -----------------------------------------------------------------------------
// 1. Runtime global : abandon uniquement sur vrais exercices, autoévaluations
//    obligatoires, fractions exclues de la normalisation visuelle.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/js/seb-ui-runtime.js');
  let out = text;

  if (!out.includes('const QCM_EXERCISE_IDS')) {
    out = replaceOnce(
      out,
      "  const QCM_EXCLUDED = new Set(['page0', 'pageFinale', 'bilanPage']);",
      "  const QCM_EXCLUDED = new Set(['page0', 'pageFinale', 'bilanPage']);\n  const QCM_EXERCISE_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);",
      'liste des vrais exercices QCM'
    );
  }

  out = replaceOnce(
    out,
    "      '#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer'",
    "      '#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer,' +\n      '#page4 .fraction-title,#page4 .items-wrapper'",
    'exclusion des fractions de la normalisation'
  );

  out = replaceOnce(
    out,
    "      if (!scope || !scope.id || QCM_EXCLUDED.has(scope.id)) return null;",
    "      if (!scope || !scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return null;",
    'abandon limité aux vrais exercices QCM'
  );

  out = replaceOnce(
    out,
    "    if (!EXERCISE_FILES.has(file)) return null;\n    return {",
    "    if (!EXERCISE_FILES.has(file)) return null;\n    if (file === 'brique.html' || file === 'tri_de_cheville.html') {\n      const auto = document.getElementById('autoEvalPart');\n      if (auto) {\n        let visible = auto.classList.contains('visible');\n        try { visible = visible || window.getComputedStyle(auto).display !== 'none'; } catch (_) {}\n        if (visible) return null;\n      }\n    }\n    return {",
    'suppression abandon pendant autoévaluations intégrées'
  );

  out = replaceOnce(
    out,
    "        if (!scope.id || QCM_EXCLUDED.has(scope.id)) return;",
    "        if (!scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return;",
    'boutons passer QCM limités aux vrais exercices'
  );

  if (!out.includes('function protectAutoEvaluations()')) {
    const autoGuard = `\n  function autoEvalHasResponse(form) {\n    if (!form) return false;\n    const checked = form.querySelector('input[type=\"checkbox\"]:checked');\n    const text = Array.from(form.querySelectorAll('textarea,input[type=\"text\"]')).some((el) => String(el.value || '').trim() !== '');\n    return !!checked || text;\n  }\n\n  function protectAutoEvaluations() {\n    const form = document.getElementById('autoEvalForm');\n    if (!form) return;\n    const file = pageName();\n    const standalone = file === 'autoeval1.html' || file === 'autoeval2.html';\n    document.querySelectorAll('button').forEach((button) => {\n      if (skipButton(button)) return;\n      const inAuto = standalone || !!button.closest('#autoEvalPart');\n      if (!inAuto) return;\n      const label = stripActionIcon(button.textContent).toLowerCase();\n      if (/^(passer|passez|étape suivante|etape suivante|page suivante|suivant)\\b/.test(label)) {\n        button.hidden = true;\n        button.style.setProperty('display', 'none', 'important');\n      }\n    });\n\n    if (document.documentElement.dataset.sebAutoEvalGuard === '1') return;\n    document.documentElement.dataset.sebAutoEvalGuard = '1';\n    document.addEventListener('click', function (event) {\n      const button = event.target && event.target.closest ? event.target.closest('button') : null;\n      if (!button) return;\n      const currentForm = document.getElementById('autoEvalForm');\n      if (!currentForm) return;\n      const currentFile = pageName();\n      const inStandalone = currentFile === 'autoeval1.html' || currentFile === 'autoeval2.html';\n      const inIntegrated = !!button.closest('#autoEvalPart');\n      if (!inStandalone && !inIntegrated) return;\n      const label = stripActionIcon(button.textContent).toLowerCase();\n      const validatesAuto = button.id === 'autoEvalBtn' || (/valider/.test(label) && /autoévaluation|autoevaluation/.test(label));\n      if (!validatesAuto) return;\n      if (autoEvalHasResponse(currentForm)) return;\n      event.preventDefault();\n      event.stopPropagation();\n      if (event.stopImmediatePropagation) event.stopImmediatePropagation();\n      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');\n    }, true);\n  }\n\n`;
    out = replaceOnce(out, '  function readAbandons() {', autoGuard + '  function readAbandons() {', 'garde autoévaluations');
  }

  out = replaceOnce(
    out,
    "    hideLegacyPassButtons();\n    refreshAbandonButton();",
    "    hideLegacyPassButtons();\n    protectAutoEvaluations();\n    refreshAbandonButton();",
    'activation garde autoévaluations'
  );

  for (const required of ['QCM_EXERCISE_IDS', 'protectAutoEvaluations', '#page4 .fraction-title', "file === 'brique.html' || file === 'tri_de_cheville.html'"]) {
    if (!out.includes(required)) fail(`runtime incomplet après correction: ${required}`, 5);
  }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Mise en page Tri et Brique + position locale du bouton Abandonner.
// -----------------------------------------------------------------------------
function patchExerciseLayout(relativePath, targetSelector, kind) {
  const { file, text } = read(relativePath);
  let out = text;
  const marker = `seb-${kind}-compact95`;
  if (!out.includes(marker)) {
    const block = `\n<style id="${marker}">\n.wrapper{max-width:none!important;width:100%!important;padding:8px 12px!important;gap:8px!important;}\n.header{padding:8px 14px!important;}\n.main{gap:8px!important;}\n#left,#right{padding:8px!important;gap:8px!important;}\n#seb-evalpro-abandon-fixed{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;margin:8px auto 0!important;align-self:center!important;min-width:220px!important;}\n</style>\n<script id="${marker}-script">\n(function(){\n  function place(){\n    const button=document.getElementById('seb-evalpro-abandon-fixed');\n    const target=document.querySelector('${targetSelector}');\n    if(button&&target&&button.parentElement!==target) target.appendChild(button);\n  }\n  document.addEventListener('DOMContentLoaded',place,{once:true});\n  setTimeout(place,0);\n  new MutationObserver(place).observe(document.documentElement,{childList:true,subtree:true});\n})();\n</script>\n`;
    out = appendBeforeBody(out, block, relativePath);
  }
  write(file, out);
}

patchExerciseLayout('app/web/brique.html', '#left', 'brique');
patchExerciseLayout('app/web/tri_de_cheville.html', '#right', 'tri');

// -----------------------------------------------------------------------------
// 3. Carré magique : après validation, verrouillage définitif de la tentative.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/carre.html');
  let out = text;
  const modular = out.includes('js/carre-page.js');
  if (modular) {
    const moduleText = read('app/web/js/carre-page.js').text;
    if (!moduleText.includes('SEB_CARRE_LOCK95')) fail('verrouillage carré magique modulaire absent', 6);
    if (!moduleText.includes('if (isValidated) return;')) fail('blocage recommencer carré magique modulaire absent', 6);
  } else {
    if (!out.includes('SEB_CARRE_LOCK95')) {
      out = replaceOnce(
        out,
        '            isValidated = true;',
        `            isValidated = true;\n            // SEB_CARRE_LOCK95 : aucune seconde tentative après affichage des réponses.\n            document.querySelectorAll('.cell').forEach(cell => { cell.disabled = true; });\n            const resetButton = document.querySelector('.btn-reset');\n            if (resetButton) { resetButton.disabled = true; resetButton.style.display = 'none'; }\n            const validateButton = document.getElementById('btnValidate');\n            if (validateButton) { validateButton.disabled = true; validateButton.style.display = 'none'; }`,
        'verrouillage après validation carré magique'
      );
      out = replaceOnce(
        out,
        '        function reset() {',
        `        function reset() {\n            if (isValidated) return;`,
        'blocage recommencer après validation carré magique'
      );
    }
    if (!out.includes('SEB_CARRE_LOCK95')) fail('verrouillage carré magique absent', 6);
    write(file, out);
  }
}

// -----------------------------------------------------------------------------
// 4. Export Word administrateur : les abandons restent visibles à l'écran,
//    mais la section spécifique n'est jamais intégrée au document Word.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/admin-bilan.html');
  let out = text;
  const oldWord = "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);prepareWordColours(t);";
  const newWord = "function word(){save();const c=cand(),t=$('#bilan').cloneNode(true);t.querySelectorAll('.seb-admin-abandon-section,.seb-admin-abandon-row').forEach(el=>el.remove());prepareWordColours(t);";
  if (!out.includes(newWord)) out = replaceOnce(out, oldWord, newWord, 'exclusion abandons export Word');
  if (!out.includes("querySelectorAll('.seb-admin-abandon-section,.seb-admin-abandon-row').forEach(el=>el.remove())")) fail('exclusion Word des abandons absente', 7);
  write(file, out);
}

// Contrôles finaux bloquants sur les pages produites.
{
  const runtime = read('app/web/js/seb-ui-runtime.js').text;
  const tri = read('app/web/tri_de_cheville.html').text;
  const brique = read('app/web/brique.html').text;
  const carre = read('app/web/carre.html').text;
  const carreModule = fs.existsSync(path.join(root, 'app', 'web', 'js', 'carre-page.js'))
    ? read('app/web/js/carre-page.js').text
    : '';
  const bilan = read('app/web/admin-bilan.html').text;
  const checks = [
    [runtime.includes("new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8'])"), 'allowlist abandon QCM'],
    [runtime.includes('Merci de compléter cette autoévaluation avant de continuer'), 'alerte autoévaluation'],
    [runtime.includes('#page4 .fraction-title'), 'fractions non normalisées'],
    [tri.includes('seb-tri-compact95') && tri.includes("document.querySelector('#right')"), 'tri élargi + abandon droite'],
    [brique.includes('seb-brique-compact95') && brique.includes("document.querySelector('#left')"), 'brique élargie + abandon gauche'],
    [(carre.includes('SEB_CARRE_LOCK95') || carreModule.includes('SEB_CARRE_LOCK95')), 'carré verrouillé après validation'],
    [bilan.includes(".seb-admin-abandon-section,.seb-admin-abandon-row').forEach(el=>el.remove())"), 'abandons exclus Word']
  ];
  const failed = checks.filter((entry) => !entry[0]).map((entry) => entry[1]);
  if (failed.length) fail('contrôles finaux échoués: ' + failed.join(', '), 8);
}

console.log('SEB EvalPro #95: abandon limité aux vrais exercices, autoévaluations obligatoires, carré verrouillé, Tri/Brique élargis, fractions préservées et abandons exclus du Word.');
