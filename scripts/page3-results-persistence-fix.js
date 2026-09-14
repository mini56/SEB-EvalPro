const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');

function fail(message, code = 2) {
  console.error('SEB EvalPro Page 3 results fix: ' + message);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1) Les réponses Page 3 officielles doivent correspondre aux calculs affichés :
// mercredi 9h05 + 0h25 = 9h30 ; rangement total = 2h35 ; moyenne = 0h31.
const oldP3 = `  7:'9h45', 8:'9h15', 9:'9h25', 10:'9h55', 11:'9h25', 12:'2h30',\n  13:'0h30', 14:'1h03'`;
const newP3 = `  7:'9h45', 8:'9h15', 9:'9h30', 10:'9h55', 11:'9h25', 12:'2h35',\n  13:'0h31', 14:'1h03'`;
if (!html.includes(newP3)) {
  if (!html.includes(oldP3)) fail('bloc des réponses Page 3 introuvable', 3);
  html = html.replace(oldP3, newP3);
}

// 2) Au rechargement de qcmv1.0.html, ne jamais repartir avec deux objets vides :
// cela peut faire disparaître des réponses déjà persistées si une sauvegarde QCM
// intervient ensuite. On réhydrate d'abord les objets globaux depuis sessionStorage.
const oldGlobals = `let reponses = {};\nlet scores   = {};`;
const newGlobals = `let reponses = {};\nlet scores   = {};\ntry {\n  reponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};\n  scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};\n} catch (_) {\n  reponses = {};\n  scores = {};\n}`;
if (!html.includes("reponses = JSON.parse(sessionStorage.getItem('reponses_data')")) {
  if (!html.includes(oldGlobals)) fail('initialisation globale réponses/scores introuvable', 4);
  html = html.replace(oldGlobals, newGlobals);
}

// 3) Chaque saveTableAnswers fusionne d'abord l'état déjà persisté. Une page ne
// peut donc plus écraser les réponses d'une page précédente après un rechargement.
const saveStart = `function saveTableAnswers(pageNum)  {`;
const mergeBlock = `function saveTableAnswers(pageNum)  {\n  try {\n    const persistedResponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};\n    const persistedScores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};\n    reponses = { ...persistedResponses, ...reponses };\n    scores = { ...persistedScores, ...scores };\n  } catch (_) {}`;
if (!html.includes('const persistedResponses = JSON.parse')) {
  if (!html.includes(saveStart)) fail('début saveTableAnswers introuvable', 5);
  html = html.replace(saveStart, mergeBlock);
}

// 4) Page 3 possède en plus une sauvegarde dédiée, indépendante du gros objet
// reponses_data. Elle sert de filet de sécurité aux Résultats stagiaire.
const p3Specific = `  if (pageNum == 3) {\n    const avgR = document.getElementById('reponse3_avg_reception');\n    const avgS = document.getElementById('reponse3_avg_rangement');\n    reponses['page3_avg_reception'] = avgR ? (avgR.value.trim() || '') : '';\n    reponses['page3_avg_rangement'] = avgS ? (avgS.value.trim() || '') : '';\n  }`;
const p3Dedicated = `  if (pageNum == 3) {\n    const avgR = document.getElementById('reponse3_avg_reception');\n    const avgS = document.getElementById('reponse3_avg_rangement');\n    reponses['page3_avg_reception'] = avgR ? (avgR.value.trim() || '') : '';\n    reponses['page3_avg_rangement'] = avgS ? (avgS.value.trim() || '') : '';\n    const page3Responses = {};\n    const page3Scores = {};\n    for (let i = 1; i <= 14; i++) {\n      page3Responses['page3_q' + i] = reponses['page3_q' + i] || '';\n      page3Scores['page3_q' + i] = Number(scores['page3_q' + i] || 0);\n    }\n    sessionStorage.setItem('page3_resultats', JSON.stringify({\n      reponses: page3Responses,\n      scores: page3Scores,\n      savedAt: new Date().toISOString()\n    }));\n  }`;
if (!html.includes("sessionStorage.setItem('page3_resultats'")) {
  if (!html.includes(p3Specific)) fail('bloc spécifique Page 3 introuvable', 6);
  html = html.replace(p3Specific, p3Dedicated);
}

// 5) Résultats stagiaire : restaurer Page 3 depuis la sauvegarde dédiée. Si elle
// n'existe pas encore (parcours déjà commencé avec un ancien prototype), tenter
// la récupération à partir du brouillon QCM persistant, puis appliquer les mêmes
// réponses officielles que l'exercice.
const resultsLoadMarker = `    console.log('✅ Réponses / Scores récupérés');\n  } catch (e) {\n    console.warn('⚠️ Erreur récupération réponses/scores:', e);\n  }`;
const resultsRecovery = `    console.log('✅ Réponses / Scores récupérés');\n  } catch (e) {\n    console.warn('⚠️ Erreur récupération réponses/scores:', e);\n  }\n\n  // Récupération renforcée Page 3 — Réception & Rangement.\n  try {\n    const dedicated = JSON.parse(sessionStorage.getItem('page3_resultats') || 'null');\n    if (dedicated && dedicated.reponses) Object.assign(reponses, dedicated.reponses);\n    if (dedicated && dedicated.scores) Object.assign(scores, dedicated.scores);\n\n    const hasPage3 = Array.from({ length: 14 }, (_, index) => index + 1)\n      .some(i => String(reponses['page3_q' + i] || '').trim() !== '');\n    if (!hasPage3) {\n      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};\n      const draft = drafts.page3;\n      if (draft && Array.isArray(draft.values)) {\n        draft.values.forEach(saved => {\n          const match = String(saved && saved.id || '').match(/^reponse3_(\\d+)$/);\n          if (!match) return;\n          const i = Number(match[1]);\n          if (i < 1 || i > 14) return;\n          const value = String(saved.value == null ? '' : saved.value).trim();\n          reponses['page3_q' + i] = value;\n          scores['page3_q' + i] = (bonnesReponsesPage3[i] && value.toUpperCase() === String(bonnesReponsesPage3[i]).toUpperCase()) ? 1 : 0;\n        });\n      }\n    }\n  } catch (e) {\n    console.warn('⚠️ Récupération renforcée Page 3 impossible:', e);\n  }`;
if (!html.includes('Récupération renforcée Page 3')) {
  if (!html.includes(resultsLoadMarker)) fail('point de récupération Résultats stagiaire introuvable', 7);
  html = html.replace(resultsLoadMarker, resultsRecovery);
}

const checks = [
  [html.includes("9:'9h30'") && html.includes("12:'2h35'") && html.includes("13:'0h31'"), 'réponses Page 3 corrigées'],
  [html.includes("reponses = JSON.parse(sessionStorage.getItem('reponses_data')"), 'réhydratation globale'],
  [html.includes('const persistedResponses = JSON.parse'), 'fusion avant sauvegarde'],
  [html.includes("sessionStorage.setItem('page3_resultats'"), 'sauvegarde dédiée Page 3'],
  [html.includes('Récupération renforcée Page 3'), 'fallback Résultats stagiaire'],
  [html.includes("drafts.page3"), 'fallback brouillon Page 3']
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) fail('contrôles finaux échoués : ' + failed.join(', '), 8);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro TEST: Page 3 persistée/restaurée dans Résultats stagiaire; réponses vérifiées = Q9 9h30, Q12 2h35, Q13 0h31.');
