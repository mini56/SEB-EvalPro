const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message, code = 2) {
  console.error('SEB EvalPro audit réponses: ' + message);
  process.exit(code);
}
function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + relativePath);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) fail('cible introuvable: ' + label, 3);
  return text.replace(search, replacement);
}
function appendBeforeBody(text, block, label) {
  const index = text.toLowerCase().lastIndexOf('</body>');
  if (index < 0) fail('balise </body> introuvable: ' + label, 3);
  return text.slice(0, index) + block + '\n' + text.slice(index);
}

// -----------------------------------------------------------------------------
// 1. QCM : comparer les réponses numériques comme des nombres, normaliser les
//    espaces des textes à trous et utiliser le même normaliseur d'heures lors
//    de la récupération de secours de la Page 3.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/qcmv1.0.html');
  let out = text;

  if (!out.includes('function sameSebNumeric')) {
    const marker = 'function saveTableAnswers(pageNum)';
    const pos = out.indexOf(marker);
    if (pos < 0) fail('saveTableAnswers introuvable', 4);
    const helper = [
      'function normalizeSebNumeric(value) {',
      "  const raw = String(value == null ? '' : value)",
      "    .replace(/\\u00A0/g, ' ')",
      "    .replace(/\\s+/g, '')",
      "    .replace(',', '.');",
      "  if (!/^[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)$/.test(raw)) return null;",
      '  const number = Number(raw);',
      '  return Number.isFinite(number) ? number : null;',
      '}',
      '',
      'function sameSebNumeric(left, right) {',
      '  const a = normalizeSebNumeric(left);',
      '  const b = normalizeSebNumeric(right);',
      '  return a !== null && b !== null && Math.abs(a - b) < 1e-9;',
      '}',
      '',
      'function normalizeSebAnswerText(value) {',
      "  return String(value == null ? '' : value)",
      "    .replace(/\\u00A0/g, ' ')",
      "    .trim()",
      "    .replace(/\\s+/g, ' ')",
      "    .toLocaleLowerCase('fr-FR');",
      '}',
      '',
      ''
    ].join('\n');
    out = out.slice(0, pos) + helper + out.slice(pos);
  }

  const page6Candidates = [
    "      scores[`page6_q${i}`] =\n         (bonnes[i] && val.replace(',', '.') === bonnes[i].toString()) ? 1 : 0;",
    "      scores[`page6_q${i}`] =\n         (bonnes[i] && val.replace(',', '.') === bonnes[i].toString().replace(',', '.')) ? 1 : 0;"
  ];
  const page6Old = page6Candidates.find(candidate => out.includes(candidate));
  if (!page6Old) fail('cible introuvable: comparaison numérique Page 6', 3);
  out = out.replace(page6Old, "      scores[`page6_q${i}`] =\n         (bonnes[i] && sameSebNumeric(val, bonnes[i])) ? 1 : 0;");

  const modularPage2 = out.includes('js/qcm-page2.js');
  const modularPage2_1 = out.includes('js/qcm-page2-1.js');
  const modularPage3 = out.includes('js/qcm-page3.js');

  if (modularPage2) {
    const modulePath = path.join(root, 'app', 'web', 'js', 'qcm-page2.js');
    if (!fs.existsSync(modulePath)) fail('Page 2: module qcm-page2.js introuvable', 4);
    const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      'function normalizeNumeric(value)',
      ".replace(/\\s+/g, '')",
      ".replace(',', '.')",
      'function sameNumeric(left, right)',
      "const answers = Object.freeze({ 1:'1020', 2:'1250', 3:'60', 4:'525', 5:'8' });"
    ]) {
      if (!moduleText.includes(token)) fail('Page 2: normalisation numérique modulaire absente: ' + token, 4);
    }
  }

  if (modularPage2_1) {
    const modulePath = path.join(root, 'app', 'web', 'js', 'qcm-page2-1.js');
    if (!fs.existsSync(modulePath)) fail('Page 2_1: module qcm-page2-1.js introuvable', 4);
    const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      'function normalizeNumeric(value)',
      ".replace(/\\s+/g, '')",
      ".replace(',', '.')",
      'function sameNumeric(left, right)',
      "const answers = Object.freeze({ 6:'10', 7:'75', 8:'12', 9:'24', 10:'165' });",
      "this.value.replace(/[^0-9.,]/g, '')"
    ]) {
      if (!moduleText.includes(token)) fail('Page 2_1: normalisation/filtrage modulaire absent: ' + token, 4);
    }
  }

  if (modularPage3) {
    const modulePath = path.join(root, 'app', 'web', 'js', 'qcm-page3.js');
    if (!fs.existsSync(modulePath)) fail('Page 3: module qcm-page3.js introuvable', 4);
    const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      'function parseTimeToMinutes(value)',
      'function sameTime(left, right)',
      "match = text.match(/^(\\d+)\\s*m$/);",
      "match = text.match(/^(\\d+)\\s*(?:h|:)\\s*(\\d{1,2})\\s*m?$/);",
      'minutes > 59',
      "13:'0h31', 14:'1h03'"
    ]) {
      if (!moduleText.includes(token)) fail('Page 3: normalisation horaire modulaire absente: ' + token, 4);
    }
  }

  const plainStandard = "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && val.toString().toUpperCase() === bonnes[i].toString().toUpperCase())\n        ? 1 : 0;";
  const timeStandard = "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()))\n        ? 1 : 0;";
  const oldStandard = modularPage3 ? plainStandard : timeStandard;
  let newStandard;
  let numericLabel;

  if (modularPage2 && modularPage2_1) {
    newStandard = modularPage3 ? plainStandard : timeStandard;
    numericLabel = modularPage3
      ? 'comparaisons modularisées Pages 2, 2_1 et 3'
      : 'comparaisons numériques modularisées Pages 2 et 2_1';
  } else if (modularPage2) {
    const tail = "pageNum === '2_1'\n          ? sameSebNumeric(val, bonnes[i])\n          : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()";
    newStandard = modularPage3
      ? "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (" + tail + "))\n        ? 1 : 0;"
      : "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : " + tail + "))\n        ? 1 : 0;";
    numericLabel = 'comparaison numérique Page 2_1 + module Page 2';
  } else {
    const tail = "(pageNum == 2 || pageNum === '2_1')\n          ? sameSebNumeric(val, bonnes[i])\n          : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()";
    newStandard = modularPage3
      ? "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (" + tail + "))\n        ? 1 : 0;"
      : "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : " + tail + "))\n        ? 1 : 0;";
    numericLabel = 'comparaison numérique Pages 2 et 2_1';
  }
  out = replaceRequired(out, oldStandard, newStandard, numericLabel);

  const oldTextTrous = "    const userAnswer = (input.value || '').trim().toLowerCase();\n    const correct    = (input.dataset && input.dataset.answer)\n                        ? input.dataset.answer.toLowerCase() : '';";
  const newTextTrous = "    const userAnswer = normalizeSebAnswerText(input.value);\n    const correct    = (input.dataset && input.dataset.answer)\n                        ? normalizeSebAnswerText(input.dataset.answer) : '';";
  out = replaceRequired(out, oldTextTrous, newTextTrous, 'normalisation Texte à trous');

  if (modularPage3) {
    if (!out.includes('window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])')) {
      fail('fallback Résultats Page 3 modulaire non tolérant', 4);
    }
  } else {
    const oldFallback = "          scores['page3_q' + i] = (bonnesReponsesPage3[i] && value.toUpperCase() === String(bonnesReponsesPage3[i]).toUpperCase()) ? 1 : 0;";
    const newFallback = "          scores['page3_q' + i] = (bonnesReponsesPage3[i] && normalizeSebTime(value) === normalizeSebTime(bonnesReponsesPage3[i])) ? 1 : 0;";
    out = replaceRequired(out, oldFallback, newFallback, 'fallback Page 3 tolérant');
  }

  if (modularPage2 && modularPage2_1) {
    if (out.includes("pageNum === '2_1'") || out.includes("pageNum == 2 || pageNum === '2_1'")) {
      fail('ancienne comparaison Pages 2/2_1 encore présente après modularisation', 4);
    }
  } else if (modularPage2) {
    if (!out.includes("pageNum === '2_1'")) fail('Page 2_1 non numérique après patch modulaire', 4);
  } else if (!out.includes("pageNum == 2 || pageNum === '2_1'")) {
    fail('Pages 2/2_1 non numériques après patch', 4);
  }
  if (!out.includes('sameSebNumeric(val, bonnes[i])')) fail('Page 6 non numérique après patch', 4);
  if (!out.includes('normalizeSebAnswerText(input.value)')) fail('Texte à trous non normalisé', 4);
  if (modularPage3) {
    if (!out.includes('window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])')) fail('fallback Page 3 modulaire non normalisé', 4);
  } else if (!out.includes('normalizeSebTime(value) === normalizeSebTime(bonnesReponsesPage3[i])')) {
    fail('fallback Page 3 non normalisé', 4);
  }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Briques et Tri : conserver la reprise. Les clés sont nettoyées par le
//    démarrage d'une nouvelle évaluation, jamais au chargement de la page.
// -----------------------------------------------------------------------------
for (const spec of [
  { file: 'app/web/brique.html', keys: ['eval_brique', 'eval_brique_auto'], label: 'Briques' },
  { file: 'app/web/tri_de_cheville.html', keys: ['tri_cheville_data', 'autoEvaltri_resultats'], label: 'Tri' }
]) {
  const loaded = read(spec.file);
  let out = loaded.text;
  for (const key of spec.keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp("\\s*sessionStorage\\.removeItem\\([\\\"']" + escaped + "[\\\"']\\);?", 'g'), '');
  }
  out = out.replace(/\\s*window\\.addEventListener\\([\"']DOMContentLoaded[\"'],\\s*clearPageData\\s*\\);?/g, '');
  for (const key of spec.keys) {
    if (out.includes("removeItem('" + key + "')") || out.includes('removeItem("' + key + '")')) {
      fail(spec.label + ': effacement destructif encore présent pour ' + key, 5);
    }
  }
  write(loaded.file, out);
}
{
  const qcm = read('app/web/qcmv1.0.html').text;
  for (const key of ['eval_brique','eval_brique_auto','tri_cheville_data','autoEvaltri_resultats']) {
    if (!qcm.includes(key)) fail('nouvelle évaluation: clé de nettoyage absente ' + key, 5);
  }
}

// -----------------------------------------------------------------------------
// 3. Genre / Nombre : accents et traits d'union restent stricts, mais les
//    espaces multiples et les apostrophes droite/typographique sont équivalents.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/genrenombres.html');
  let out = text;
  const modularGenreNombre = out.includes('js/genrenombres-page.js');

  if (modularGenreNombre) {
    const modulePath = path.join(root, 'app', 'web', 'js', 'genrenombres-page.js');
    if (!fs.existsSync(modulePath)) fail('Genre/Nombre: module genrenombres-page.js introuvable', 6);
    const moduleText = fs.readFileSync(modulePath, 'utf8').replace(/\r\n/g, '\n');
    for (const token of [
      ".replace(/\\u00A0/g, ' ')",
      ".replace(/[’‘]/g, \"'\")",
      ".replace(/\\s+/g, ' ')",
      ".toLocaleLowerCase('fr-FR')",
      'possibleAnswers(input).some((answer) => user === norm(answer))'
    ]) {
      if (!moduleText.includes(token)) fail('Genre/Nombre: comparaison modulaire non normalisée: ' + token, 6);
    }
  } else {
  const { file, text } = read('app/web/genrenombres.html');
  let out = text;
  const normRegex = /function norm\(s\)\{[\s\S]*?\n  \}/;
  if (!normRegex.test(out)) fail('Genre/Nombre: fonction norm introuvable', 6);
  out = out.replace(normRegex, [
    'function norm(s){',
    "    return String(s == null ? '' : s)",
    "      .replace(/\\u00A0/g, ' ')",
    "      .replace(/[’‘]/g, \"'\")",
    "      .trim()",
    "      .replace(/\\s+/g, ' ')",
    "      .toLocaleLowerCase('fr-FR');",
    '  }'
  ].join('\n'));

  const oldCompare = "      const isCorrect = possibleAnswers.some(answer =>\n        userAnswer.toLowerCase() === answer.toLowerCase().trim()\n      );";
  const newCompare = "      const isCorrect = possibleAnswers.some(answer =>\n        norm(userAnswer) === norm(answer)\n      );";
  out = replaceRequired(out, oldCompare, newCompare, 'Genre/Nombre comparaison normalisée');
  if (!out.includes(".replace(/[’‘]/g, \"'\")")) fail('Genre/Nombre: apostrophes non normalisées', 6);
  if (!out.includes('norm(userAnswer) === norm(answer)')) fail('Genre/Nombre: comparaison non normalisée', 6);
  write(file, out);

  }

  write(file, out);
}

// -----------------------------------------------------------------------------
// 4. Paronymes : Apitoiement -> Pitié. Attendrissement, également défendable,
//    est remplacé par un distracteur non synonyme.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/paronymes.html');
  let out = text;
  const finalRow = '<tr><td class="paronyme">Apitoiement</td><td data-correct="true">Pitié</td><td>Appétence</td><td>Indifférence</td><td>Capiteux</td><td>Piété</td></tr>';
  const legacyRowRegex = /<tr><td class="paronyme">Apitoiement<\/td><td(?: data-correct="true")?>Pitié<\/td><td>Appétence<\/td><td(?: data-correct="true")?>Attendrissement<\/td><td>Capiteux<\/td><td>Piété<\/td><\/tr>/;
  if (out.includes(finalRow)) {
    // Source déjà alignée sur la correction validée.
  } else if (legacyRowRegex.test(out)) {
    out = out.replace(legacyRowRegex, finalRow);
  } else {
    fail('Paronymes: ligne Apitoiement introuvable', 7);
  }
  const rows = (out.match(/<tr>[\s\S]*?<\/tr>/g) || []).filter((row) => row.includes('class="paronyme"'));
  if (rows.length !== 20) fail('Paronymes: ' + rows.length + ' lignes au lieu de 20', 7);
  rows.forEach((row, index) => {
    const count = (row.match(/data-correct="true"/g) || []).length;
    if (count !== 1) fail('Paronymes: ligne ' + (index + 1) + ', ' + count + ' réponse(s) correcte(s)', 7);
  });
  if (!out.includes('<td data-correct="true">Pitié</td>')) fail('Paronymes: Pitié non retenu', 7);
  if (/Apitoiement[\s\S]{0,200}Attendrissement/.test(out)) fail('Paronymes: Attendrissement encore proposé', 7);
  write(file, out);
}

// -----------------------------------------------------------------------------
// 5. Messagerie : la source fonctionnelle est désormais js/nvmail-page.js.
//    Le build vérifie la logique validée mais ne la réécrit plus.
// -----------------------------------------------------------------------------
{
  const { text } = read('app/web/js/nvmail-page.js');
  for (const required of [
    'function objetMailCandidatValide',
    "return objet === (prenom + ' mail seb').trim();",
    'function telephoneMailValide',
    'function signatureCandidatValide',
    "String(to || '').trim() === 'conseil.perso@sauvegarde56.org'",
    "String(cc || '').trim() === 'stage-pro@sauvegarde56.org'",
    'const score_subject = objetMailCandidatValide(subject, prenomCandidat) ? 1 : 0;',
    'const score_signature = signatureCandidatValide(message, prenomCandidat, nomCandidat) ? 1 : 0;',
    'const score_telephone = telephoneMailValide(message) ? 1 : 0;',
    "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));"
  ]) {
    if (!text.includes(required)) fail('Messagerie: contrat externalisé absent: ' + required, 8);
  }
  if (/const regexPoints = \/\\d\{2\}/.test(text)) fail('Messagerie: ancien contrôle téléphone réintroduit', 8);
  if (/sessionStorage\.removeItem\(['"]page8_data['"]\)/.test(text)) fail('Messagerie: effacement de reprise réintroduit', 8);
}

// -----------------------------------------------------------------------------
// 6. Traitement de texte : le moteur externe est la seule source fonctionnelle.
//    Aucun script inline n'est injecté dans la page.
// -----------------------------------------------------------------------------
{
  const { text } = read('app/web/nwtexte.html');
  const engine = read('app/web/js/nwtexte-quill-engine.js').text;
  if (/spellcheck="true"/.test(text)) fail('Traitement de texte: correcteur natif encore actif', 9);
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(text)) fail('Traitement de texte: script inline réintroduit', 9);
  if (!engine.includes("quill.root.setAttribute('spellcheck', 'false')")) fail('Traitement de texte: correcteur Quill encore actif', 9);
  const hasPage7Score = engine.includes('scores.page7 = analyse.score.total;');
  const hasScoresWrite = engine.includes("sessionStorage.setItem('scores_data'");
  if (!hasPage7Score || !hasScoresWrite) {
    console.error('NWTEXTE_ENGINE_DIAG page7Score=' + hasPage7Score + ' scoresWrite=' + hasScoresWrite + ' length=' + engine.length);
    const savePos = engine.indexOf('function saveEvaluation');
    console.error(engine.slice(Math.max(0, savePos - 500), savePos >= 0 ? savePos + 4500 : 4500));
    fail('Traitement de texte: notation Page 7 absente du moteur Quill', 9);
  }
}

// -----------------------------------------------------------------------------
// 6b. Dictée : correctif minimal et isolé.
//     - aucune MutationObserver ajoutée ;
//     - Vérifier/Suivant historiques restent le moteur interne mais sont cachés ;
//     - la correction reste masquée uniquement par CSS ;
//     - 1er clic : « Dictée terminée » -> calcul/enregistrement -> « Suivant » ;
//     - 2e clic : navigation historique vers le Tri.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/dictee.html');
  let out = text;
  if (!out.includes('id="verifyBtn"') || !out.includes('id="nextBtn"') || !out.includes('id="candidateText"')) {
    fail('Dictée: contrôles historiques introuvables', 9);
  }

  if (!out.includes('id="seb-dictee-stable-style"')) {
    const patch = [
      '<style id="seb-dictee-stable-style">',
      '#verifyBtn,#nextBtn,#feedback{display:none!important;visibility:hidden!important;}',
      '#seb-dictee-action{display:inline-flex!important;position:fixed!important;left:50%!important;right:auto!important;bottom:22px!important;transform:translateX(-50%)!important;z-index:1200!important;margin:0!important;align-self:auto!important;font-weight:700;}',
      '</style>',
      '<script id="seb-dictee-stable-runtime">',
      '(function(){',
      "  'use strict';",
      "  const KEY='dictee_data';",
      "  const text=document.getElementById('candidateText');",
      "  const verify=document.getElementById('verifyBtn');",
      "  const next=document.getElementById('nextBtn');",
      '  if(!text||!verify||!next)return;',
      "  let finish=document.getElementById('seb-dictee-action');",
      "  if(!finish){finish=document.createElement('button');finish.id='seb-dictee-action';finish.type='button';verify.insertAdjacentElement('beforebegin',finish);}",
      '  function readState(){try{return JSON.parse(sessionStorage.getItem(KEY)||"null")}catch(_){return null}}',
      '  function setMode(){',
      '    const d=readState();',
      "    const done=!!(d&&(d.status==='verified'||d.status==='abandoned'));",
      "    finish.textContent=done?'Suivant':'Dictée terminée';",
      "    finish.dataset.mode=done?'next':'finish';",
      '    finish.disabled=false;',
      "    if(done&&d.status==='verified')text.disabled=true;",
      '  }',
      "  finish.addEventListener('click',function(){",
      '    const d=readState();',
      "    if(d&&(d.status==='verified'||d.status==='abandoned')){",
      '      finish.disabled=true;',
      '      next.disabled=false;',
      "      next.removeAttribute('disabled');",
      '      next.click();',
      '      return;',
      '    }',
      "    if(!String(text.value||'').trim()){window.alert('Saisissez le texte entendu avant de cliquer sur « Dictée terminée », ou utilisez « Abandonner l’exercice ».');try{text.focus()}catch(_){}return;}",
      '    finish.disabled=true;',
      '    verify.disabled=false;',
      "    verify.removeAttribute('disabled');",
      '    verify.click();',
      '    setTimeout(function(){',
      '      const after=readState();',
      "      if(after&&after.status==='verified'){setMode();return;}",
      '      finish.disabled=false;',
      "      finish.textContent='Dictée terminée';",
      "      finish.dataset.mode='finish';",
      "      const status=document.getElementById('status');",
      "      if(status)status.textContent='La dictée n’a pas pu être enregistrée. Cliquez de nouveau sur « Dictée terminée ».';",
      '    },120);',
      '  });',
      '  setMode();',
      '})();',
      '</script>'
    ].join('\n');
    out = appendBeforeBody(out, patch, 'Dictée stable sans correction visible');
  }

  if (!out.includes('id="seb-dictee-stable-runtime"')) fail('Dictée: runtime stable absent', 9);
  if (!out.includes("finish.textContent=done?'Suivant':'Dictée terminée'")) fail('Dictée: bouton deux états absent', 9);
  if (!out.includes('verify.click();')) fail('Dictée: moteur de correction historique non appelé', 9);
  if (!out.includes('next.click();')) fail('Dictée: navigation historique absente', 9);
  if (!out.includes('#verifyBtn,#nextBtn,#feedback{display:none!important')) fail('Dictée: correction/anciens boutons non masqués', 9);
  if (!out.includes('position:fixed!important;left:50%!important;right:auto!important;bottom:22px!important;transform:translateX(-50%)!important')) {
    fail('Dictée: bouton final non centré', 9);
  }
  if (/MutationObserver[\s\S]{0,220}(?:feedback|hideFeedback)|(?:feedback|hideFeedback)[\s\S]{0,220}MutationObserver/.test(out)) {
    fail('Dictée: MutationObserver de masquage interdit', 9);
  }
  const results = read('app/web/qcmv1.0.html').text;
  if (!results.includes('seb-dictee-complex-results-v3')) fail('Dictée: correction détaillée Résultats absente', 9);
  write(file, out);
}

// -----------------------------------------------------------------------------
// 7. Tests fonctionnels de normalisation indépendants du DOM.
// -----------------------------------------------------------------------------
{
  function numeric(v) {
    const raw = String(v == null ? '' : v).replace(/\u00A0/g, ' ').replace(/\s+/g, '').replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const n = Number(raw); return Number.isFinite(n) ? n : null;
  }
  function sameNumber(a,b){ const x=numeric(a),y=numeric(b); return x!==null&&y!==null&&Math.abs(x-y)<1e-9; }
  if (!sameNumber('2,5','2.50') || !sameNumber('1 250','1250') || !sameNumber('010','10')) fail('test normalisation numérique', 10);

  function textAnswer(v){ return String(v||'').replace(/\u00A0/g,' ').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr-FR'); }
  if (textAnswer('  préparateur   de commandes ') !== textAnswer('préparateur de commandes')) fail('test Texte à trous espaces', 10);
  if (textAnswer('conseille') === textAnswer('conseillé')) fail('test Texte à trous accents trop permissif', 10);

  function genre(v){ return String(v||'').replace(/\u00A0/g,' ').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLocaleLowerCase('fr-FR'); }
  if (genre("Des chefs-d'œuvre") !== genre("  des  chefs-d'œuvre  ")) fail('test Genre/Nombre espaces', 10);
  if (genre("d’œuvre") !== genre("d'œuvre")) fail('test Genre/Nombre apostrophe', 10);
  if (genre('equipe') === genre('équipe')) fail('test Genre/Nombre accents trop permissif', 10);
  if (genre('chefs d’œuvre') === genre('chefs-d’œuvre')) fail('test Genre/Nombre trait union trop permissif', 10);

  function id(v){ return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
  function subjectOK(subject, prenom){ const a=id(subject),p=id(prenom); return !!a&&!!p&&a===(p+' mail seb').trim(); }
  if (!subjectOK('ÉLODIE Mail-SEB','Élodie') || !subjectOK('élodie   mail-seb','Élodie') || subjectOK('Mail-SEB Élodie','Élodie')) fail('test objet mail', 10);
  const phone = (m) => /(^|[^\d])0\d(?:[\s.,\/-]?\d{2}){4}(?!\d)/.test(String(m||''));
  if (!phone('06 10 34 45 79') || !phone('0297801478') || phone('16 10 34 45 79')) fail('test téléphone', 10);
}

console.log('SEB EvalPro audit réponses: corrections appliquées et contrôles bloquants OK.');
