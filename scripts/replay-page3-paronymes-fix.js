const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro replay/page3/paronymes: ' + message);
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
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}

// 1) Brancher le capteur de navigation garanti dans le preload généré.
{
  const { file, text } = read('src/preload.js');
  let out = text;
  if (!out.includes("require('./replay-navigation-capture')")) {
    out = replaceOnce(
      out,
      "const replayPrototype = require('./replay-preload');",
      "const replayPrototype = require('./replay-preload');\nconst replayNavigationCapture = require('./replay-navigation-capture');",
      'import capteur navigation replay'
    );
  }
  if (!out.includes('replayNavigationCapture.install();')) {
    out = replaceOnce(
      out,
      '  replayPrototype.install();',
      '  replayPrototype.install();\n  replayNavigationCapture.install();',
      'installation capteur navigation replay'
    );
  }
  write(file, out);
}

// 2) Le capteur historique ne doit plus lancer sa capture asynchrone sur un
// bouton de navigation : celle-ci pouvait terminer après nextPage() et écraser
// l'image de page3 par l'écran suivant. Le nouveau module ci-dessus capture et
// attend la fin AVANT de laisser la navigation continuer.
{
  const { file, text } = read('src/replay-preload.js');
  let out = text;
  if (!out.includes('SEB_REPLAY_NAV_CAPTURE_GUARD')) {
    const oldBlock = `  document.addEventListener('click', (event) => {\n    const target = event.target && event.target.closest ? event.target.closest('button,a,input,select,textarea,[contenteditable]') : null;\n    if (!target) return;\n    captureCurrentPage('before-action', true);\n    scheduleCapture('after-action', 320);\n  }, true);`;
    const newBlock = `  document.addEventListener('click', (event) => {\n    const target = event.target && event.target.closest ? event.target.closest('button,a,input,select,textarea,[contenteditable]') : null;\n    if (!target) return;\n    // SEB_REPLAY_NAV_CAPTURE_GUARD : les navigations sont capturées de façon\n    // bloquante par replay-navigation-capture.js afin de ne jamais associer\n    // l'écran suivant à la clé de la page précédente.\n    const label = String(target.textContent || target.value || '').replace(/\\s+/g, ' ').trim().toLowerCase();\n    const id = String(target.id || '').toLowerCase();\n    const onclick = String(target.getAttribute && target.getAttribute('onclick') || '').toLowerCase();\n    const href = String(target.getAttribute && target.getAttribute('href') || '').trim();\n    const nav = /^(suivant|suivante|page suivante|étape suivante|etape suivante|passer|passez|continuer)\\b/.test(label) ||\n      /(next|suivant)/.test(id) || /nextpage\\s*\\(|location\\.href|window\\.location/.test(onclick) ||\n      (String(target.tagName || '').toLowerCase() === 'a' && href && !href.startsWith('#') && !href.toLowerCase().startsWith('javascript:'));\n    if (nav) return;\n    captureCurrentPage('before-action', true);\n    scheduleCapture('after-action', 320);\n  }, true);`;
    out = replaceOnce(out, oldBlock, newBlock, 'suppression course capture/navigation');
  }
  write(file, out);
}

// 3) Paronymes : la logique validée vit désormais dans le module source.
{
  const paronymes = read('app/web/paronymes.html').text;
  const moduleText = read('app/web/js/paronymes-page.js').text;
  const arborRow = paronymes.match(/<tr><td class="paronyme">Arboré<\/td>[\s\S]*?<\/tr>/i);
  if (!arborRow || !/data-correct="true">Boisé<\/td>/i.test(arborRow[0])) {
    fail('invariant Paronymes invalide : Arboré -> Boisé non marqué correct', 4);
  }
  if (!moduleText.includes('isCorrect = corrects.includes(selected)')) {
    fail('durcissement score Paronymes absent du module', 5);
  }
  if (!moduleText.includes("sessionStorage.setItem(ERRORS_KEY, JSON.stringify(responses.filter((response) => !response.correct)))")) {
    fail('diagnostic Paronymes absent du module', 5);
  }
}

// 4) Contrôles bloquants sur ce correctif de test.
{
  const preload = read('src/preload.js').text;
  const replay = read('src/replay-preload.js').text;
  const paronymes = read('app/web/paronymes.html').text;
  const paronymesModule = read('app/web/js/paronymes-page.js').text;
  const navModule = read('src/replay-navigation-capture.js').text;
  const checks = [
    [preload.includes("require('./replay-navigation-capture')") && preload.includes('replayNavigationCapture.install();'), 'capteur navigation non branché'],
    [replay.includes('SEB_REPLAY_NAV_CAPTURE_GUARD'), 'garde anti-course replay absente'],
    [navModule.includes("captureNow('navigation-before-guaranteed')"), 'capture garantie avant navigation absente'],
    [navModule.includes("document.addEventListener('focusout'"), 'capture de sortie de champ absente'],
    [/data-correct="true">Boisé<\/td>/i.test(paronymes), 'Boisé non marqué correct'],
    [paronymesModule.includes('isCorrect = corrects.includes(selected)'), 'score Paronymes non durci'],
    [paronymesModule.includes("const ERRORS_KEY = 'paronymes_erreurs_detail'"), 'diagnostic Paronymes absent']
  ];
  const failed = checks.filter((x) => !x[0]).map((x) => x[1]);
  if (failed.length) fail('contrôles finaux échoués : ' + failed.join(', '), 6);
}

console.log('SEB EvalPro TEST: page3 capturée avant navigation; Paronymes Arboré -> Boisé vérifié et diagnostic des erreurs activé.');
