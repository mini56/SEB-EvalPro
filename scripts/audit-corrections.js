const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'app', 'web');

function read(name) {
  const file = path.join(webDir, name);
  if (!fs.existsSync(file)) throw new Error(`SEB EvalPro audit: page générée introuvable : ${name}`);
  return { file, html: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, html) {
  fs.writeFileSync(file, html, 'utf8');
}

function mustReplace(html, search, replacement, label) {
  const found = typeof search === 'string' ? html.includes(search) : search.test(html);
  if (!found) throw new Error(`SEB EvalPro audit: cible introuvable pour ${label}`);
  if (search instanceof RegExp) search.lastIndex = 0;
  return html.replace(search, replacement);
}

function injectBeforeBodyEnd(html, block) {
  const index = html.toLowerCase().lastIndexOf('</body>');
  if (index < 0) return `${html}\n${block}\n`;
  return `${html.slice(0, index)}${block}\n${html.slice(index)}`;
}

function patchQcm() {
  const { file, html } = read('qcmv1.0.html');
  let out = html;
  const externalRuntime = out.includes('js/qcm-runtime.js');
  const runtimeLoaded = externalRuntime ? read('js/qcm-runtime.js') : null;
  let logic = runtimeLoaded ? runtimeLoaded.html : out;

  if (out.includes('js/qcm-page6.js')) {
    const { html: page6 } = read('js/qcm-page6.js');
    for (const token of [
      'function normalizeNumeric(value)',
      ".replace(',', '.')",
      'function sameNumeric(left, right)',
      "3:'2.5'",
      "8:'5.6'"
    ]) {
      if (!page6.includes(token)) {
        throw new Error('SEB EvalPro audit: contrat numérique Page 6 modulaire absent : ' + token);
      }
    }
  } else {
    logic = mustReplace(
      logic,
      "(bonnes[i] && val.replace(',', '.') === bonnes[i].toString())",
      "(bonnes[i] && val.replace(',', '.') === bonnes[i].toString().replace(',', '.'))",
      'conversion page 6 avec virgule ou point'
    );
  }

  logic = mustReplace(
    logic,
    /\s*total \+= scoreTexte;\s*totalQuestions \+= 8;/,
    "\n      // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.",
    'exclusion ancien texte libre du score général'
  );

  logic = mustReplace(
    logic,
    /\s*total \+= score7;\s*totalQuestions \+= scoreMax;/,
    "\n    // Le traitement de texte est évalué séparément dans le bilan : il n'entre pas dans le score général.",
    'exclusion traitement de texte du score général'
  );

  logic = mustReplace(
    logic,
    'const scoreMax = 7;',
    'const scoreMax = 8;',
    'score maximum traitement de texte affiché'
  );

  logic = mustReplace(
    logic,
    "html += `<span class=\"${analyse.score.texte_taille ? 'correct' : 'incorrect'}\">${analyse.score.texte_taille ? '✓' : '✗'} Taille 12px (détecté: ${analyse.texte.taille || 'inconnue'})</span>`;",
    "html += `<span class=\"${analyse.score.texte_taille ? 'correct' : 'incorrect'}\">${analyse.score.texte_taille ? '✓' : '✗'} Taille 12px (détecté: ${analyse.texte.taille || 'inconnue'})</span>`;\n    html += `<span class=\"${analyse.score.enregistrement ? 'correct' : 'incorrect'}\">${analyse.score.enregistrement ? '✓' : '✗'} Enregistrement via le menu Fichier</span>`;",
    'affichage critère enregistrement traitement de texte'
  );

  if (runtimeLoaded) write(runtimeLoaded.file, logic);
  else out = logic;
  write(file, out);
}

function patchAdminBilan() {
  const { file, html } = read('admin-bilan.html');
  let out = html;

  out = mustReplace(out, 'Math.round(pr/27*100)', 'Math.round(pr/28*100)', 'dénominateur mathématiques bilan');
  out = mustReplace(out, "'- '+pr+' / 27 réponses correctes ('+p+' %)'", "'- '+pr+' / 28 réponses correctes ('+p+' %)'", 'affichage dénominateur mathématiques bilan');
  out = mustReplace(out, "'- '+v+' / 7 point(s)'", "'- '+v+' / 8 point(s)'", 'affichage score traitement de texte bilan');

  write(file, out);
}

function patchMailResume() {
  const { html } = read('nvmail.html');
  const { html: controller } = read('js/nvmail-page.js');

  for (const expected of [
    'conseil.perso@sauvegarde56.org',
    'stage-pro@sauvegarde56.org'
  ]) {
    if (!html.includes('>' + expected + '<')) {
      throw new Error('SEB EvalPro audit: adresse visible nvmail incorrecte ou absente : ' + expected);
    }
  }
  if (/@(Sauvegarde56\.org)/.test(html)) {
    throw new Error('SEB EvalPro audit: nvmail affiche encore Sauvegarde56.org avec un S majuscule');
  }

  for (const forbidden of [
    "toLowerCase() === 'conseil.perso@sauvegarde56.org'",
    "toLowerCase() === 'stage-pro@sauvegarde56.org'",
    "sessionStorage.removeItem('page8_data')"
  ]) {
    if (controller.includes(forbidden)) {
      throw new Error('SEB EvalPro audit: logique nvmail interdite : ' + forbidden);
    }
  }

  for (const required of [
    "String(to || '').trim() === 'conseil.perso@sauvegarde56.org'",
    "String(cc || '').trim() === 'stage-pro@sauvegarde56.org'",
    'function signatureCandidatValide',
    'function objetMailCandidatValide',
    'function telephoneMailValide',
    "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))",
    "window.sebParcours.goNext('nvmail')"
  ]) {
    if (!controller.includes(required)) {
      throw new Error('SEB EvalPro audit: contrat nvmail absent : ' + required);
    }
  }

  if (!html.includes('js/nvmail-page.js') || /function\s+evaluerFormulaire\s*\(/.test(html)) {
    throw new Error('SEB EvalPro audit: logique nvmail non externalisée');
  }
}

function patchGenreNombreResume() {
  const { file, html } = read('genrenombres.html');

  if (html.includes('js/genrenombres-page.js')) {
    const moduleFile = path.join(webDir, 'js', 'genrenombres-page.js');
    if (!fs.existsSync(moduleFile)) throw new Error('SEB EvalPro audit: module genrenombres-page.js introuvable');
    const moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      "const ANSWERS_KEY = 'user_genrenombres';",
      "const ERRORS_KEY = 'erreurs_exercice';",
      "const STATE_KEY = 'seb_evalpro_genrenombres_state';",
      'function restoreState()',
      "window.sebParcours.goNext('genrenombres')"
    ]) {
      if (!moduleText.includes(token)) throw new Error('SEB EvalPro audit: contrat Genre/Nombre modulaire absent: ' + token);
    }
    if (/removeItem\(['"]erreurs_exercice/.test(moduleText)) {
      throw new Error('SEB EvalPro audit: effacement destructif Genre/Nombre réintroduit');
    }
    return;
  }

  const out = mustReplace(
    html,
    "  // clear previous data for this page\n  try { sessionStorage.removeItem('erreurs_exercice'); } catch(e){}\n",
    "  // Les données précédentes sont conservées pendant l'évaluation pour permettre la reprise.\n",
    'suppression nettoyage destructif genre/nombre'
  );
  write(file, out);
}

function patchStockScoring() {
  const { file, html } = read('stock.html');

  if (html.includes('js/stock-page.js')) {
    const moduleFile = path.join(webDir, 'js', 'stock-page.js');
    if (!fs.existsSync(moduleFile)) throw new Error('SEB EvalPro audit: module stock-page.js introuvable');
    const moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      "const TOTAL_EVALUATED = 33;",
      "const EXAMPLE_ID = '8';",
      "document.querySelectorAll('.pot:not([data-seb-example=\"true\"])')",
      'function computeScore(mark)',
      "sessionStorage.setItem(ERROR_KEY, String(score.errors));"
    ]) {
      if (!moduleText.includes(token)) throw new Error('SEB EvalPro audit: contrat Stock modulaire absent: ' + token);
    }
    return;
  }

  let out = html;
  out = mustReplace(
    out,
    "        if (!parent.classList.contains('case')) return;",
    "        if (!parent.classList.contains('case')) {\n            pot.classList.add('incorrect');\n            errorCount++;\n            return;\n        }",
    'comptage des flacons non rangés'
  );
  out = mustReplace(
    out,
    "        if (!niveau) return;",
    "        if (!niveau) {\n            pot.classList.add('incorrect');\n            errorCount++;\n            return;\n        }",
    'comptage des flacons sans niveau valide'
  );
  write(file, out);
}

function patchAutoEval1() {
  const { file, html } = read('autoeval1.html');
  let out = html;

  // Version modulaire : les deux anciennes corrections inline sont désormais
  // intégrées dans le contrôleur source et ne doivent plus être réinjectées.
  if (out.includes('js/autoeval1-page.js')) {
    const moduleFile = path.join(webDir, 'js', 'autoeval1-page.js');
    if (!fs.existsSync(moduleFile)) throw new Error('SEB EvalPro audit: module autoeval1 introuvable');
    const moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));",
      "window.sebParcours.goNext('autoeval1')",
      'function validateAndNext()'
    ]) {
      if (!moduleText.includes(token)) throw new Error('SEB EvalPro audit: contrat autoeval1 modulaire absent: ' + token);
    }
    return;
  }

  out = mustReplace(
    out,
    'onclick="saveAutoEval1(); passerEtapeSuivante()"',
    'onclick="saveAutoEval1()"',
    'double action bouton autoévaluation 1'
  );
  out = mustReplace(
    out,
    /function passerEtapeSuivante\(\) \{\s*if \(confirm\("Souhaitez-vous passer à l'étape suivante \?"\)\) \{\s*\/\/ Même comportement que le bouton principal : enregistre avant de passer\s*saveAutoEval1\(\);\s*\}\s*\}/,
    "function passerEtapeSuivante() {\n  saveAutoEval1();\n}",
    'simplification étape suivante autoévaluation 1'
  );
  write(file, out);
}

function patchBriqueZeroErrorsAndCheckpoint() {
  const { file, html } = read('brique.html');

  if (html.includes('js/brique-page.js')) {
    if (!/<input\s+id="nivDiff"[^>]*\bmin="0"\s+max="10"/.test(html)) {
      throw new Error('SEB EvalPro audit: zéro erreur Brique non autorisé');
    }
    const moduleFile = path.join(webDir, 'js', 'brique-page.js');
    if (!fs.existsSync(moduleFile)) throw new Error('SEB EvalPro audit: module brique-page.js introuvable');
    const moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      "const DATA_KEY = 'eval_brique';",
      "const AUTO_KEY = 'eval_brique_auto';",
      "const CHECKPOINT_KEY = 'seb_evalpro_brique_checkpoint';",
      'const PERIOD_SECONDS = 1;',
      'function persistCheckpoint(force)',
      'function restoreCheckpoint()',
      "window.sebParcours.goNext('brique')"
    ]) {
      if (!moduleText.includes(token)) throw new Error('SEB EvalPro audit: contrat Brique modulaire absent: ' + token);
    }
    return;
  }

  let out = html;
  out = mustReplace(out, 'type="number" min="1" max="10"', 'type="number" min="0" max="10"', 'zéro erreur briques');
  out = mustReplace(out, 'const PERIOD_SECONDS = 10 * 60;', 'const PERIOD_SECONDS = 1;', 'checkpoint briques chaque seconde');
  write(file, out);
}

function patchWordScoring() {
  // nwtexte est désormais propre en source : aucune réécriture fonctionnelle ici.
  const { html } = read('nwtexte.html');
  const enginePath = path.join(webDir, 'js', 'nwtexte-quill-engine.js');
  const savePath = path.join(webDir, 'js', 'nwtexte-save-simulation.js');
  if (!fs.existsSync(enginePath) || !fs.existsSync(savePath)) {
    throw new Error('SEB EvalPro audit: moteur nwtexte généré introuvable');
  }
  const engine = fs.readFileSync(enginePath, 'utf8').replace(/\r\n/g, '\n');
  const save = fs.readFileSync(savePath, 'utf8').replace(/\r\n/g, '\n');

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) || /\son[a-z]+\s*=/i.test(html)) {
    throw new Error('SEB EvalPro audit: ancien code inline réintroduit dans nwtexte');
  }
  for (const token of [
    'enregistrement: savedCorrectly ? 1 : 0',
    'scores.page7 = analyse.score.total;',
    'responses.page7_analyse = analyse;',
    'window.sebNwtexteEditor = editorApi'
  ]) {
    if (!engine.includes(token)) throw new Error('SEB EvalPro audit: contrat nwtexte absent: ' + token);
  }
  if (!save.includes("const STORAGE_KEY = 'nwtexte_save_simulation'") ||
      !save.includes('window.sebNwtexteSave = Object.freeze')) {
    throw new Error('SEB EvalPro audit: simulation enregistrement nwtexte absente');
  }
}

function patchTriLiveChrono() {
  const { file, html } = read('tri_de_cheville.html');
  let out = html;

  if (html.includes('js/tri-page.js')) {
    const moduleFile = path.join(webDir, 'js', 'tri-page.js');
    if (!fs.existsSync(moduleFile)) throw new Error('SEB EvalPro audit: module tri-page.js absent');
    const moduleText = fs.readFileSync(moduleFile, 'utf8');
    for (const token of [
      "const LIVE_KEY = 'seb_evalpro_tri_live_chrono';",
      'persistLiveChrono();',
      'function restoreTri()',
      'function startChrono()',
      'function stopChrono()'
    ]) {
      if (!moduleText.includes(token)) throw new Error('SEB EvalPro audit: reprise Tri modulaire absente: ' + token);
    }
    return;
  }
  out = mustReplace(
    out,
    'let triStarted = false;',
    "let triStarted = Number(sessionStorage.getItem('seb_evalpro_tri_live_chrono') || '0') > 0;",
    'reprise état tri en cours'
  );
  out = mustReplace(
    out,
    "chronoSeconds = 0;\n    if (typeof updateChronoDisplay === 'function') updateChronoDisplay();",
    "chronoSeconds = 0;\n    sessionStorage.setItem('seb_evalpro_tri_live_chrono', '0');\n    if (typeof updateChronoDisplay === 'function') updateChronoDisplay();",
    'remise à zéro checkpoint tri après validation'
  );
  const patch = `
<script id="seb-evalpro-tri-live-resume">
(function(){
  const KEY = 'seb_evalpro_tri_live_chrono';
  function persist(){
    try {
      if (typeof chronoSeconds !== 'number') return;
      sessionStorage.setItem(KEY, String(Math.max(0, Math.floor(chronoSeconds))));
    } catch (_) {}
  }
  function restore(){
    try {
      const saved = Number(sessionStorage.getItem(KEY));
      if (!Number.isFinite(saved) || saved <= 0 || typeof chronoSeconds !== 'number') return;
      chronoSeconds = Math.floor(saved);
      if (typeof updateChronoDisplay === 'function') updateChronoDisplay();
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', function(){
    restore();
    setInterval(function(){ persist(); }, 1000);
  });
})();
</script>`;
  write(file, injectBeforeBodyEnd(out, patch));
}

function installGenericResume() {
  // nwtexte est volontairement exclu : Quill possède son propre moteur
  // transactionnel de sauvegarde/restauration. Deux moteurs concurrents
  // provoquaient des restaurations de DOM incohérentes.
  const pages = [
    'autoeval1.html', 'autoeval2.html', 'brique.html', 'carre.html', 'genrenombres.html',
    'nvmail.html', 'paronymes.html', 'planning.html', 'stock.html', 'tri_de_cheville.html'
  ];
  const runtimeRef = '<script src="js/seb-page-draft-resume.js" id="seb-evalpro-page-draft-resume"></script>';

  pages.forEach((name) => {
    const { file, html } = read(name);
    if (html.includes('seb-evalpro-page-draft-resume')) return;
    write(file, injectBeforeBodyEnd(html, runtimeRef));
  });

  const nwtexte = read('nwtexte.html').html;
  if (nwtexte.includes('seb-evalpro-page-draft-resume')) {
    throw new Error('SEB EvalPro audit: reprise générique interdite dans nwtexte');
  }
}

patchQcm();
patchAdminBilan();
patchMailResume();
patchGenreNombreResume();
patchStockScoring();
patchAutoEval1();
patchBriqueZeroErrorsAndCheckpoint();
patchWordScoring();
patchTriLiveChrono();
installGenericResume();

console.log('SEB EvalPro audit: corrections validées appliquées (barèmes, reprise, stock, autoévaluations, briques, traitement de texte).');
