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

  const oldPage6 = "      scores[`page6_q${i}`] =\n         (bonnes[i] && val.replace(',', '.') === bonnes[i].toString()) ? 1 : 0;";
  const newPage6 = "      scores[`page6_q${i}`] =\n         (bonnes[i] && sameSebNumeric(val, bonnes[i])) ? 1 : 0;";
  out = replaceRequired(out, oldPage6, newPage6, 'comparaison numérique Page 6');

  const oldStandard = "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()))\n        ? 1 : 0;";
  const newStandard = "    scores[`page${pageNum}_q${i}`] =\n      (bonnes && bonnes[i] && (pageNum == 3\n        ? normalizeSebTime(val) === normalizeSebTime(bonnes[i])\n        : (pageNum == 2 || pageNum === '2_1')\n          ? sameSebNumeric(val, bonnes[i])\n          : val.toString().toUpperCase() === bonnes[i].toString().toUpperCase()))\n        ? 1 : 0;";
  out = replaceRequired(out, oldStandard, newStandard, 'comparaison numérique Pages 2 et 2_1');

  const oldTextTrous = "    const userAnswer = (input.value || '').trim().toLowerCase();\n    const correct    = (input.dataset && input.dataset.answer)\n                        ? input.dataset.answer.toLowerCase() : '';";
  const newTextTrous = "    const userAnswer = normalizeSebAnswerText(input.value);\n    const correct    = (input.dataset && input.dataset.answer)\n                        ? normalizeSebAnswerText(input.dataset.answer) : '';";
  out = replaceRequired(out, oldTextTrous, newTextTrous, 'normalisation Texte à trous');

  const oldFallback = "          scores['page3_q' + i] = (bonnesReponsesPage3[i] && value.toUpperCase() === String(bonnesReponsesPage3[i]).toUpperCase()) ? 1 : 0;";
  const newFallback = "          scores['page3_q' + i] = (bonnesReponsesPage3[i] && normalizeSebTime(value) === normalizeSebTime(bonnesReponsesPage3[i])) ? 1 : 0;";
  out = replaceRequired(out, oldFallback, newFallback, 'fallback Page 3 tolérant');

  if (!out.includes("pageNum == 2 || pageNum === '2_1'")) fail('Pages 2/2_1 non numériques après patch', 4);
  if (!out.includes('sameSebNumeric(val, bonnes[i])')) fail('Page 6 non numérique après patch', 4);
  if (!out.includes('normalizeSebAnswerText(input.value)')) fail('Texte à trous non normalisé', 4);
  if (!out.includes('normalizeSebTime(value) === normalizeSebTime(bonnesReponsesPage3[i])')) fail('fallback Page 3 non normalisé', 4);
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Briques et Tri : aucune donnée d'une évaluation en cours ne doit être
//    effacée au simple rechargement/ouverture de la page. Le nettoyage reste
//    assuré au démarrage d'une nouvelle évaluation par le QCM.
// -----------------------------------------------------------------------------
for (const spec of [
  { file: 'app/web/brique.html', keys: ['eval_brique', 'eval_brique_auto'], label: 'Briques' },
  { file: 'app/web/tri_de_cheville.html', keys: ['tri_cheville_data', 'autoEvaltri_resultats'], label: 'Tri' }
]) {
  const loaded = read(spec.file);
  let out = loaded.text;
  const keyA = spec.keys[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyB = spec.keys[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const destructive = new RegExp(
    "\\s*// Fonction pour effacer les données de cette page à son ouverture\\s*" +
    "function clearPageData\\(\\) \\{\\s*" +
    "sessionStorage\\.removeItem\\([\\\"']" + keyA + "[\\\"']\\);\\s*" +
    "sessionStorage\\.removeItem\\([\\\"']" + keyB + "[\\\"']\\);[\\s\\S]*?" +
    "window\\.addEventListener\\([\\\"']DOMContentLoaded[\\\"'], clearPageData\\);",
    'g'
  );
  out = out.replace(destructive, '\n// SEB EvalPro : reprise conservée, aucun effacement au chargement.\n');
  if (new RegExp("sessionStorage\\.removeItem\\([\\\"']" + keyA + "[\\\"']\\)").test(out)) {
    fail(spec.label + ': effacement destructif encore présent', 5);
  }
  if (new RegExp("sessionStorage\\.removeItem\\([\\\"']" + keyB + "[\\\"']\\)").test(out)) {
    fail(spec.label + ': effacement destructif autoévaluation encore présent', 5);
  }
  write(loaded.file, out);
}
{
  const qcm = read('app/web/qcmv1.0.html').text;
  for (const key of ['eval_brique','eval_brique_auto','tri_cheville_data','autoEvaltri_resultats']) {
    if (!qcm.includes("'" + key + "'") && !qcm.includes('"' + key + '"')) {
      fail('nouvelle évaluation: clé de nettoyage absente ' + key, 5);
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Genre / Nombre : accents et traits d'union restent stricts, mais les
//    espaces multiples et les apostrophes droite/typographique sont équivalents.
// -----------------------------------------------------------------------------
{
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

// -----------------------------------------------------------------------------
// 4. Paronymes : Apitoiement -> Pitié. Attendrissement, également défendable,
//    est remplacé par un distracteur non synonyme.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/paronymes.html');
  let out = text;
  const rowRegex = /<tr><td class="paronyme">Apitoiement<\/td><td(?: data-correct="true")?>Pitié<\/td><td>Appétence<\/td><td(?: data-correct="true")?>Attendrissement<\/td><td>Capiteux<\/td><td>Piété<\/td><\/tr>/;
  if (!rowRegex.test(out)) fail('Paronymes: ligne Apitoiement introuvable', 7);
  out = out.replace(rowRegex, '<tr><td class="paronyme">Apitoiement</td><td data-correct="true">Pitié</td><td>Appétence</td><td>Indifférence</td><td>Capiteux</td><td>Piété</td></tr>');
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
// 5. Messagerie : objet exactement de la forme Prénom + Mail-SEB, comparaison
//    tolérante à la casse/accents/espaces ; téléphone = 10 chiffres commençant
//    par 0, avec séparateurs usuels optionnels.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/nvmail.html');
  let out = text;
  if (!out.includes('function objetMailCandidatValide')) {
    const marker = 'function evaluerFormulaire(event) {';
    const pos = out.indexOf(marker);
    if (pos < 0) fail('Messagerie: evaluerFormulaire introuvable', 8);
    const helpers = [
      'function objetMailCandidatValide(subject, prenomCandidat) {',
      '  const objet = normaliserIdentiteMail(subject);',
      '  const prenom = normaliserIdentiteMail(prenomCandidat);',
      '  if (!objet || !prenom) return false;',
      "  return objet === (prenom + ' mail seb').trim();",
      '}',
      '',
      'function telephoneMailValide(message) {',
      "  const texte = String(message || '');",
      "  return /(^|[^\\d])0\\d(?:[\\s.,\\/-]?\\d{2}){4}(?!\\d)/.test(texte);",
      '}',
      '',
      ''
    ].join('\n');
    out = out.slice(0, pos) + helpers + out.slice(pos);
  }

  const subjectEvalRegex = /  \/\/ CRITÈRE 3 : Objet \(format : Prénom Mail-SEB\)[\s\S]*?  if \(objetOK\) \{/;
  if (!subjectEvalRegex.test(out)) fail('Messagerie: bloc objet formulaire introuvable', 8);
  out = out.replace(subjectEvalRegex,
    "  // CRITÈRE 3 : Objet (format : Prénom Mail-SEB)\n  const objetOK = objetMailCandidatValide(objet, prenomCandidat);\n\n  if (objetOK) {");

  const phoneEvalRegex = /  \/\/ ============================================\n  \/\/ CRITÈRE 6 : Numéro de téléphone \(10 chiffres\)\n  \/\/ ============================================[\s\S]*?  if \(hasTelephone\) \{/;
  if (!phoneEvalRegex.test(out)) fail('Messagerie: bloc téléphone formulaire introuvable', 8);
  out = out.replace(phoneEvalRegex,
    "  // ============================================\n  // CRITÈRE 6 : Numéro de téléphone (10 chiffres commençant par 0)\n  // ============================================\n  const hasTelephone = telephoneMailValide(message);\n\n  if (hasTelephone) {");

  const subjectSaveRegex = /  \/\/ Validation de l'objet :[\s\S]*?  const score_file =/;
  if (!subjectSaveRegex.test(out)) fail('Messagerie: bloc objet sauvegarde introuvable', 8);
  out = out.replace(subjectSaveRegex,
    "  // Validation de l'objet : Prénom Mail-SEB, casse et accents tolérés.\n  const score_subject = objetMailCandidatValide(subject, prenomCandidat) ? 1 : 0;\n\n  const score_file =");

  const phoneSaveRegex = /  \/\/ Validation du numéro de téléphone \(10 chiffres avec différents séparateurs\)[\s\S]*?  \/\/ CALCUL DU SCORE TOTAL/;
  if (!phoneSaveRegex.test(out)) fail('Messagerie: bloc téléphone sauvegarde introuvable', 8);
  out = out.replace(phoneSaveRegex,
    "  // Validation du numéro de téléphone : 10 chiffres commençant par 0.\n  const score_telephone = telephoneMailValide(message) ? 1 : 0;\n\n  // CALCUL DU SCORE TOTAL");

  if ((out.match(/objetMailCandidatValide\(/g) || []).length < 3) fail('Messagerie: objet non centralisé', 8);
  if ((out.match(/telephoneMailValide\(/g) || []).length < 3) fail('Messagerie: téléphone non centralisé', 8);
  if (/const regexPoints = \/\\d\{2\}/.test(out)) fail('Messagerie: ancien contrôle téléphone encore présent', 8);
  write(file, out);
}

// -----------------------------------------------------------------------------
// 6. Traitement de texte : aucune correction orthographique/suggestion pendant
//    la rédaction. Le moteur de notation continue d'enregistrer l'analyse pour
//    la page Résultats, sans retour correctif au stagiaire dans l'éditeur.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/nwtexte.html');
  let out = text.replace(/spellcheck="true"/g, 'spellcheck="false"');
  if (!out.includes('id="seb-no-live-text-correction"')) {
    const patch = [
      '<script id="seb-no-live-text-correction">',
      '(function(){',
      "  'use strict';",
      '  function disableLiveCorrection(){',
      "    document.querySelectorAll('#editor,.ql-editor,[contenteditable=\"true\"]').forEach(function(editor){",
      "      editor.setAttribute('spellcheck', 'false');",
      "      editor.setAttribute('autocorrect', 'off');",
      "      editor.setAttribute('autocapitalize', 'off');",
      '      editor.spellcheck = false;',
      '    });',
      '  }',
      "  document.addEventListener('DOMContentLoaded', function(){",
      '    disableLiveCorrection();',
      '    setTimeout(disableLiveCorrection, 0);',
      '    setTimeout(disableLiveCorrection, 250);',
      '  });',
      '})();',
      '</script>'
    ].join('\n');
    out = appendBeforeBody(out, patch, 'Traitement de texte sans correction en direct');
  }
  if (/spellcheck="true"/.test(out)) fail('Traitement de texte: correcteur natif encore actif', 9);
  if (!out.includes('seb-no-live-text-correction')) fail('Traitement de texte: garde anti-correction absente', 9);
  if (!out.includes("scores['page7']") && !out.includes('scores[\'page7\']')) fail('Traitement de texte: notation Page 7 absente', 9);
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
