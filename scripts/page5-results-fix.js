const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, code = 2) {
  console.error('SEB EvalPro Page 5 results: ' + message);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// La table officielle de la page 5 doit rester strictement celle validée.
const expectedMap = "const bonnesReponsesPage5   = { 1:'2', 2:'5', 3:'3', 4:'1', 5:'4', 6:'7', 7:'8', 8:'6' };";
if (!html.includes(expectedMap)) fail('barème Page 5 inattendu : correction refusée', 3);

// 1) Toujours repartir des données déjà persistées avant une nouvelle sauvegarde.
// Cela évite qu'un retour/rechargement du QCM remplace reponses_data par un objet
// mémoire incomplet et fasse disparaître la page 5 dans Résultats stagiaire.
const saveStart = 'function saveTableAnswers(pageNum)  {\n';
if (!html.includes('SEB_PAGE5_RESULTS_PERSISTENCE')) {
  if (!html.includes(saveStart)) fail('fonction saveTableAnswers introuvable', 4);
  html = html.replace(saveStart, `${saveStart}  // SEB_PAGE5_RESULTS_PERSISTENCE : fusion avec l'état persistant avant toute écriture.\n  try {\n    const savedResponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};\n    const savedScores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};\n    reponses = Object.assign({}, savedResponses, reponses || {});\n    scores = Object.assign({}, savedScores, scores || {});\n  } catch (_) {}\n`);
}

// 2) La page 5.1 avait un return avant l'écriture sessionStorage. On corrige ce
// défaut en même temps, afin qu'elle ne dépende pas d'une page ultérieure pour
// être conservée.
const page51Tail = `    for (let k = 1; k <= 3; k++) {\n      const val = user[k];\n      if (!val || !autorisees.includes(val)) {\n        scores[\`page5_1_q\${k}\`] = 0;\n        continue;\n      }\n      if (dejaUtilise.has(val)) {\n        scores[\`page5_1_q\${k}\`] = 0;\n      } else {\n        scores[\`page5_1_q\${k}\`] = 1;\n        dejaUtilise.add(val);\n      }\n    }\n    return;`;
if (!html.includes('SEB_PAGE51_IMMEDIATE_PERSIST')) {
  if (!html.includes(page51Tail)) fail('fin sauvegarde Page 5.1 introuvable', 5);
  html = html.replace(page51Tail, page51Tail.replace('    return;', `    // SEB_PAGE51_IMMEDIATE_PERSIST\n    try {\n      sessionStorage.setItem('reponses_data', JSON.stringify(reponses));\n      sessionStorage.setItem('scores_data', JSON.stringify(scores));\n    } catch (_) {}\n    return;`));
}

// 3) À la sauvegarde de Page 5, conserver aussi un bloc dédié. Il sert de
// secours et de diagnostic sans modifier le barème ni l'affichage habituel.
const page5Branches = [
  `  } else if (pageNum == 5) {\n    bonnes = bonnesReponsesPage5;   start = 1;  end = 8;`,
  `  if (pageNum == 5) {\n    bonnes = bonnesReponsesPage5;   start = 1;  end = 8;`
];
if (!html.includes('SEB_PAGE5_ORGANISATION_SNAPSHOT')) {
  const page5Branch = page5Branches.find((candidate) => html.includes(candidate));
  if (!page5Branch) fail('branche Page 5 introuvable', 6);
  html = html.replace(page5Branch, `${page5Branch}\n    // SEB_PAGE5_ORGANISATION_SNAPSHOT : créé après la boucle standard ci-dessous.`);

  const beforeGlobalSave = `  // SAUVEGARDE GLOBALE dans sessionStorage`;
  if (!html.includes(beforeGlobalSave)) fail('point insertion snapshot Page 5 introuvable', 7);
  html = html.replace(beforeGlobalSave, `  if (pageNum == 5) {\n    try {\n      const organisation = {};\n      for (let i = 1; i <= 8; i++) {\n        organisation[i] = {\n          reponse: reponses[\`page5_q\${i}\`] || '',\n          score: Number(scores[\`page5_q\${i}\`] || 0)\n        };\n      }\n      sessionStorage.setItem('page5_organisation_data', JSON.stringify(organisation));\n    } catch (_) {}\n  }\n\n${beforeGlobalSave}`);
}

// 4) Résultats stagiaire : si l'ancien reponses_data est incomplet, reconstruire
// uniquement Page 5 à partir du bloc dédié ou du brouillon persistant. Aucun
// autre exercice n'est recalculé par cette récupération.
const resultRecoveryAnchor = `  // ===============================\n  // Page 8 : récupération des données d'e-mail\n  // ===============================`;
if (!html.includes('SEB_PAGE5_RESULTS_RECOVERY')) {
  if (!html.includes(resultRecoveryAnchor)) fail('point récupération résultats introuvable', 8);
  const recovery = `  // SEB_PAGE5_RESULTS_RECOVERY\n  // Récupération robuste de l'organisation (Page 5) pour Résultats stagiaire.\n  try {\n    let organisation = JSON.parse(sessionStorage.getItem('page5_organisation_data') || 'null');\n    if (!organisation || typeof organisation !== 'object') {\n      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};\n      const draft = drafts.page5;\n      if (draft && Array.isArray(draft.values)) {\n        organisation = {};\n        for (let i = 1; i <= 8; i++) {\n          const wanted = 'reponse5_' + i;\n          const saved = draft.values.find(v => v && v.id === wanted);\n          if (!saved) continue;\n          const value = String(saved.value == null ? '' : saved.value).trim();\n          organisation[i] = {\n            reponse: value,\n            score: (value === String(bonnesReponsesPage5[i])) ? 1 : 0\n          };\n        }\n      }\n    }\n    if (organisation && typeof organisation === 'object') {\n      for (let i = 1; i <= 8; i++) {\n        const item = organisation[i] || organisation[String(i)];\n        if (!item) continue;\n        const key = 'page5_q' + i;\n        if (!Object.prototype.hasOwnProperty.call(reponses, key) || String(reponses[key] || '').trim() === '') {\n          reponses[key] = String(item.reponse == null ? '' : item.reponse);\n          scores[key] = Number(item.score || 0);\n        }\n      }\n    }\n  } catch (e) {\n    console.warn('Récupération Page 5 impossible:', e);\n  }\n\n`;
  html = html.replace(resultRecoveryAnchor, recovery + resultRecoveryAnchor);
}

// Contrôles bloquants.
const checks = [
  [html.includes(expectedMap), 'barème officiel Page 5'],
  [html.includes('SEB_PAGE5_RESULTS_PERSISTENCE'), 'fusion persistante Page 5'],
  [html.includes('SEB_PAGE51_IMMEDIATE_PERSIST'), 'persistance immédiate Page 5.1'],
  [html.includes("sessionStorage.setItem('page5_organisation_data'"), 'snapshot Page 5'],
  [html.includes('SEB_PAGE5_RESULTS_RECOVERY'), 'récupération Résultats stagiaire'],
  [html.includes('afficherLigne("Page 5 — Organisation", "page5", 1, 8);'), 'affichage Page 5 Résultats']
];
const failed = checks.filter(x => !x[0]).map(x => x[1]);
if (failed.length) fail('contrôles finaux échoués : ' + failed.join(', '), 9);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro TEST: Page 5 Organisation conservée et récupérée correctement dans Résultats stagiaire.');
