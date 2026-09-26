const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');
const moduleFile = path.join(root, 'app', 'web', 'js', 'qcm-page5.js');
const module51File = path.join(root, 'app', 'web', 'js', 'qcm-page5-1.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro Page 5 results: ' + message);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const modularPage5 = html.includes('js/qcm-page5.js');
const modularPage5_1 = html.includes('js/qcm-page5-1.js');
const modularPage6 = html.includes('js/qcm-page6.js');
let moduleText = '';
let module51Text = '';

const expectedMap = "const bonnesReponsesPage5   = { 1:'2', 2:'5', 3:'3', 4:'1', 5:'4', 6:'7', 7:'8', 8:'6' };";

if (modularPage5) {
  if (!fs.existsSync(moduleFile)) fail('module qcm-page5.js introuvable', 3);
  moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
  for (const token of [
    "const SNAPSHOT_KEY = 'page5_organisation_data';",
    "const STATE_KEY = 'seb_evalpro_qcm_page5_state';",
    "1:'2', 2:'5', 3:'3', 4:'1'",
    "5:'4', 6:'7', 7:'8', 8:'6'",
    "storedResponses[key] = result.details[i].reponse;",
    "storedScores[key] = result.details[i].correct ? 1 : 0;",
    "sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));",
    "window.sebParcours.goNext('qcm-5')"
  ]) {
    if (!moduleText.includes(token)) fail('contrat Page 5 modulaire absent: ' + token, 3);
  }
  if (html.includes(expectedMap)) fail('ancien barème Page 5 encore inline malgré modularisation', 3);
} else if (!html.includes(expectedMap)) {
  fail('barème Page 5 inattendu : correction refusée', 3);
}

if (modularPage5_1) {
  if (!fs.existsSync(module51File)) fail('module qcm-page5-1.js introuvable', 3);
  module51Text = fs.readFileSync(module51File, 'utf8').replace(/\r\n/g, '\n');
  for (const token of [
    "const STATE_KEY = 'seb_evalpro_qcm_page5_1_state';",
    "const ALLOWED = Object.freeze(['2', '3', '5']);",
    'const used = new Set();',
    'const duplicate = allowed && used.has(response);',
    "storedResponses['page5_1_q' + i] = result.details[i].reponse;",
    "storedScores['page5_1_q' + i] = result.details[i].correct ? 1 : 0;",
    "window.sebParcours.goNext('qcm-5_1')"
  ]) {
    if (!module51Text.includes(token)) fail('contrat Page 5.1 modulaire absent: ' + token, 3);
  }
  if (html.includes("const bonnesReponsesPage5_1")) fail('ancien barème Page 5.1 encore inline malgré modularisation', 3);
}

// Tant que certaines pages utilisent encore saveTableAnswers, fusionner l'état
// déjà persisté avant toute nouvelle écriture. Lorsque Page 5, 5.1 et 6 sont
// toutes modularisées, chaque contrôleur fusionne lui-même reponses_data/scores_data.
if (!html.includes('SEB_PAGE5_RESULTS_PERSISTENCE') && !(modularPage5 && modularPage5_1 && modularPage6)) {
  const saveStarts = [
    'function saveTableAnswers(pageNum)  {\n',
    'function saveTableAnswers(pageNum) {\n'
  ];
  const saveStart = saveStarts.find((candidate) => html.includes(candidate));
  if (!saveStart) fail('fonction saveTableAnswers introuvable', 4);
  html = html.replace(
    saveStart,
    `${saveStart}  // SEB_PAGE5_RESULTS_PERSISTENCE : fusion avec l'état persistant avant toute écriture.\n  try {\n    const savedResponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};\n    const savedScores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};\n    reponses = Object.assign({}, savedResponses, reponses || {});\n    scores = Object.assign({}, savedScores, scores || {});\n  } catch (_) {}\n`
  );
}

// Page 5.1 historique : persistance immédiate avant le return.
// Si Page 5.1 est modulaire, cette responsabilité appartient à qcm-page5-1.js.
if (!modularPage5_1) {
  const page51Tail = `    for (let k = 1; k <= 3; k++) {\n      const val = user[k];\n      if (!val || !autorisees.includes(val)) {\n        scores[\`page5_1_q\${k}\`] = 0;\n        continue;\n      }\n      if (dejaUtilise.has(val)) {\n        scores[\`page5_1_q\${k}\`] = 0;\n      } else {\n        scores[\`page5_1_q\${k}\`] = 1;\n        dejaUtilise.add(val);\n      }\n    }\n    return;`;
  if (!html.includes('SEB_PAGE51_IMMEDIATE_PERSIST')) {
    if (!html.includes(page51Tail)) fail('fin sauvegarde Page 5.1 introuvable', 5);
    html = html.replace(
      page51Tail,
      page51Tail.replace(
        '    return;',
        `    // SEB_PAGE51_IMMEDIATE_PERSIST\n    try {\n      sessionStorage.setItem('reponses_data', JSON.stringify(reponses));\n      sessionStorage.setItem('scores_data', JSON.stringify(scores));\n    } catch (_) {}\n    return;`
      )
    );
  }
}

// Ancienne Page 5 non modulaire : conserver son snapshot historique.
if (!modularPage5 && !html.includes('SEB_PAGE5_ORGANISATION_SNAPSHOT')) {
  const page5Branches = [
    `  } else if (pageNum == 5) {\n    bonnes = bonnesReponsesPage5;   start = 1;  end = 8;`,
    `  if (pageNum == 5) {\n    bonnes = bonnesReponsesPage5;   start = 1;  end = 8;`
  ];
  const page5Branch = page5Branches.find((candidate) => html.includes(candidate));
  if (!page5Branch) fail('branche Page 5 introuvable', 6);
  html = html.replace(page5Branch, `${page5Branch}\n    // SEB_PAGE5_ORGANISATION_SNAPSHOT : créé après la boucle standard ci-dessous.`);

  const beforeGlobalSave = '  // SAUVEGARDE GLOBALE dans sessionStorage';
  if (!html.includes(beforeGlobalSave)) fail('point insertion snapshot Page 5 introuvable', 7);
  html = html.replace(
    beforeGlobalSave,
    `  if (pageNum == 5) {\n    try {\n      const organisation = {};\n      for (let i = 1; i <= 8; i++) {\n        organisation[i] = {\n          reponse: reponses[\`page5_q\${i}\`] || '',\n          score: Number(scores[\`page5_q\${i}\`] || 0)\n        };\n      }\n      sessionStorage.setItem('page5_organisation_data', JSON.stringify(organisation));\n    } catch (_) {}\n  }\n\n${beforeGlobalSave}`
  );
}

// Résultats stagiaire : récupération dédiée Page 5, puis état canonique,
// puis ancien brouillon si nécessaire.
const resultRecoveryAnchor = `  // ===============================\n  // Page 8 : récupération des données d'e-mail\n  // ===============================`;
if (!html.includes('SEB_PAGE5_RESULTS_RECOVERY')) {
  if (!html.includes(resultRecoveryAnchor)) fail('point récupération résultats introuvable', 8);

  const recovery = modularPage5
    ? `  // SEB_PAGE5_RESULTS_RECOVERY\n  try {\n    let organisation = JSON.parse(sessionStorage.getItem('page5_organisation_data') || 'null');\n\n    if (!organisation || typeof organisation !== 'object') {\n      const state = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page5_state') || 'null');\n      if (state && state.values) {\n        organisation = {};\n        for (let i = 1; i <= 8; i++) {\n          const value = String(state.values[i] == null ? '' : state.values[i]).trim();\n          organisation[i] = {\n            reponse:value,\n            score:(window.sebQcmPage5 && value === String(window.sebQcmPage5.answers[i])) ? 1 : 0\n          };\n        }\n      }\n    }\n\n    if (!organisation || typeof organisation !== 'object') {\n      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};\n      const draft = drafts.page5;\n      if (draft && Array.isArray(draft.values)) {\n        organisation = {};\n        for (let i = 1; i <= 8; i++) {\n          const wanted = 'reponse5_' + i;\n          const saved = draft.values.find(v => v && v.id === wanted);\n          if (!saved) continue;\n          const value = String(saved.value == null ? '' : saved.value).trim();\n          organisation[i] = {\n            reponse:value,\n            score:(window.sebQcmPage5 && value === String(window.sebQcmPage5.answers[i])) ? 1 : 0\n          };\n        }\n      }\n    }\n\n    if (organisation && typeof organisation === 'object') {\n      for (let i = 1; i <= 8; i++) {\n        const item = organisation[i] || organisation[String(i)];\n        if (!item) continue;\n        const key = 'page5_q' + i;\n        if (!Object.prototype.hasOwnProperty.call(reponses, key) || String(reponses[key] || '').trim() === '') {\n          reponses[key] = String(item.reponse == null ? '' : item.reponse);\n          scores[key] = Number(item.score || 0);\n        }\n      }\n    }\n  } catch (e) {\n    console.warn('Récupération Page 5 impossible:', e);\n  }\n\n`
    : `  // SEB_PAGE5_RESULTS_RECOVERY\n  try {\n    let organisation = JSON.parse(sessionStorage.getItem('page5_organisation_data') || 'null');\n    if (!organisation || typeof organisation !== 'object') {\n      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};\n      const draft = drafts.page5;\n      if (draft && Array.isArray(draft.values)) {\n        organisation = {};\n        for (let i = 1; i <= 8; i++) {\n          const wanted = 'reponse5_' + i;\n          const saved = draft.values.find(v => v && v.id === wanted);\n          if (!saved) continue;\n          const value = String(saved.value == null ? '' : saved.value).trim();\n          organisation[i] = {\n            reponse:value,\n            score:(value === String(bonnesReponsesPage5[i])) ? 1 : 0\n          };\n        }\n      }\n    }\n    if (organisation && typeof organisation === 'object') {\n      for (let i = 1; i <= 8; i++) {\n        const item = organisation[i] || organisation[String(i)];\n        if (!item) continue;\n        const key = 'page5_q' + i;\n        if (!Object.prototype.hasOwnProperty.call(reponses, key) || String(reponses[key] || '').trim() === '') {\n          reponses[key] = String(item.reponse == null ? '' : item.reponse);\n          scores[key] = Number(item.score || 0);\n        }\n      }\n    }\n  } catch (e) {\n    console.warn('Récupération Page 5 impossible:', e);\n  }\n\n`;

  html = html.replace(resultRecoveryAnchor, recovery + resultRecoveryAnchor);
}

const checks = [
  [(modularPage5 && modularPage5_1 && modularPage6) || html.includes('SEB_PAGE5_RESULTS_PERSISTENCE'), 'fusion persistante pages historiques'],
  [modularPage5_1 ? module51Text.includes("sessionStorage.setItem(RESPONSE_STORAGE, JSON.stringify(storedResponses));") : html.includes('SEB_PAGE51_IMMEDIATE_PERSIST'), 'persistance immédiate Page 5.1'],
  [html.includes('SEB_PAGE5_RESULTS_RECOVERY'), 'récupération Résultats stagiaire'],
  [html.includes('afficherLigne("Page 5 — Organisation", "page5", 1, 8);'), 'affichage Page 5 Résultats']
];
if (modularPage5) {
  checks.push([moduleText.includes("sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));"), 'snapshot Page 5 modulaire']);
  checks.push([html.includes('seb_evalpro_qcm_page5_state'), 'fallback état canonique Page 5']);
} else {
  checks.push([html.includes(expectedMap), 'barème officiel Page 5']);
  checks.push([html.includes("sessionStorage.setItem('page5_organisation_data'"), 'snapshot Page 5']);
}

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) fail('contrôles finaux échoués : ' + failed.join(', '), 9);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro TEST: Page 5 Organisation conservée et récupérée correctement dans Résultats stagiaire.');
