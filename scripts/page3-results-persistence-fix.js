const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'app', 'web', 'qcmv1.0.html');
const moduleFile = path.join(root, 'app', 'web', 'js', 'qcm-page3.js');

function fail(message, code = 2) {
  console.error('SEB EvalPro Page 3 results fix: ' + message);
  process.exit(code);
}

if (!fs.existsSync(file)) fail('qcmv1.0.html généré introuvable');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const modularPage3 = html.includes('js/qcm-page3.js');
let moduleText = '';

if (modularPage3) {
  if (!fs.existsSync(moduleFile)) fail('module qcm-page3.js introuvable', 3);
  moduleText = fs.readFileSync(moduleFile, 'utf8').replace(/\r\n/g, '\n');
  for (const token of [
    "1:'9h15', 2:'8h50', 3:'9h05', 4:'9h20', 5:'8h45', 6:'5h15'",
    "7:'9h45', 8:'9h15', 9:'9h30', 10:'9h55', 11:'9h25', 12:'2h35'",
    "13:'0h31', 14:'1h03'",
    "const DEDICATED_KEY = 'page3_resultats';",
    "sessionStorage.setItem(DEDICATED_KEY",
    'function parseTimeToMinutes(value)',
    'function sameTime(left, right)'
  ]) {
    if (!moduleText.includes(token)) fail('contrat Page 3 modulaire absent: ' + token, 3);
  }
  if (html.includes("9:'9h25', 10:'9h55', 11:'9h25', 12:'2h30'") ||
      html.includes("13:'0h30', 14:'1h03'")) {
    fail('anciennes réponses erronées Page 3 réintroduites', 3);
  }
} else {
  const expectedP3 = `const bonnesReponsesPage3   = {
  1:"9h15", 2:'8h50', 3:'9h05', 4:'9h20', 5:'8h45', 6:'5h15',
  7:'9h45', 8:'9h15', 9:'9h30', 10:'9h55', 11:'9h25', 12:'2h35',
  13:'0h31', 14:'1h03'
};`;
  if (!html.includes(expectedP3)) fail('réponses officielles Page 3 absentes ou modifiées', 3);
}

// Toujours réhydrater les objets QCM globaux : les autres pages historiques
// utilisent encore saveTableAnswers().
const oldGlobals = `let reponses = {};
let scores   = {};`;
const newGlobals = `let reponses = {};
let scores   = {};
try {
  reponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};
  scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};
} catch (_) {
  reponses = {};
  scores = {};
}`;
if (!html.includes("reponses = JSON.parse(sessionStorage.getItem('reponses_data')")) {
  if (!html.includes(oldGlobals)) fail('initialisation globale réponses/scores introuvable', 4);
  html = html.replace(oldGlobals, newGlobals);
}

const saveStart = `function saveTableAnswers(pageNum)  {`;
const mergeBlock = `function saveTableAnswers(pageNum)  {
  try {
    const persistedResponses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}') || {};
    const persistedScores = JSON.parse(sessionStorage.getItem('scores_data') || '{}') || {};
    reponses = { ...persistedResponses, ...reponses };
    scores = { ...persistedScores, ...scores };
  } catch (_) {}`;
if (!html.includes('const persistedResponses = JSON.parse')) {
  if (!html.includes(saveStart)) fail('début saveTableAnswers introuvable', 5);
  html = html.replace(saveStart, mergeBlock);
}

if (!modularPage3) {
  const p3Specific = `  if (pageNum == 3) {
    const avgR = document.getElementById('reponse3_avg_reception');
    const avgS = document.getElementById('reponse3_avg_rangement');
    reponses['page3_avg_reception'] = avgR ? (avgR.value.trim() || '') : '';
    reponses['page3_avg_rangement'] = avgS ? (avgS.value.trim() || '') : '';
  }`;
  const p3Dedicated = `  if (pageNum == 3) {
    const avgR = document.getElementById('reponse3_avg_reception');
    const avgS = document.getElementById('reponse3_avg_rangement');
    reponses['page3_avg_reception'] = avgR ? (avgR.value.trim() || '') : '';
    reponses['page3_avg_rangement'] = avgS ? (avgS.value.trim() || '') : '';
    const page3Responses = {};
    const page3Scores = {};
    for (let i = 1; i <= 14; i++) {
      page3Responses['page3_q' + i] = reponses['page3_q' + i] || '';
      page3Scores['page3_q' + i] = Number(scores['page3_q' + i] || 0);
    }
    sessionStorage.setItem('page3_resultats', JSON.stringify({
      reponses: page3Responses,
      scores: page3Scores,
      savedAt: new Date().toISOString()
    }));
  }`;
  if (!html.includes("sessionStorage.setItem('page3_resultats'")) {
    if (!html.includes(p3Specific)) fail('bloc spécifique Page 3 introuvable', 6);
    html = html.replace(p3Specific, p3Dedicated);
  }
}

// Résultats stagiaire : la sauvegarde dédiée reste prioritaire. Pour un parcours
// ancien, récupération depuis l'état canonique modulaire puis l'ancien brouillon.
const resultsLoadMarker = `    console.log('✅ Réponses / Scores récupérés');
  } catch (e) {
    console.warn('⚠️ Erreur récupération réponses/scores:', e);
  }`;

const modularRecovery = `    console.log('✅ Réponses / Scores récupérés');
  } catch (e) {
    console.warn('⚠️ Erreur récupération réponses/scores:', e);
  }

  // Récupération renforcée Page 3 — Réception & Rangement.
  try {
    const dedicated = JSON.parse(sessionStorage.getItem('page3_resultats') || 'null');
    if (dedicated && dedicated.reponses) Object.assign(reponses, dedicated.reponses);
    if (dedicated && dedicated.scores) Object.assign(scores, dedicated.scores);

    let hasPage3 = Array.from({ length: 14 }, (_, index) => index + 1)
      .some(i => String(reponses['page3_q' + i] || '').trim() !== '');

    if (!hasPage3) {
      const canonical = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_page3_state') || 'null');
      if (canonical && canonical.values) {
        for (let i = 1; i <= 14; i++) {
          const value = String(canonical.values[i] == null ? '' : canonical.values[i]).trim();
          reponses['page3_q' + i] = value;
          scores['page3_q' + i] = (window.sebQcmPage3 && window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])) ? 1 : 0;
        }
        hasPage3 = true;
      }
    }

    if (!hasPage3) {
      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};
      const draft = drafts.page3;
      if (draft && Array.isArray(draft.values)) {
        draft.values.forEach(saved => {
          const match = String(saved && saved.id || '').match(/^reponse3_(\\d+)$/);
          if (!match) return;
          const i = Number(match[1]);
          if (i < 1 || i > 14) return;
          const value = String(saved.value == null ? '' : saved.value).trim();
          reponses['page3_q' + i] = value;
          scores['page3_q' + i] = (window.sebQcmPage3 && window.sebQcmPage3.sameTime(value, window.sebQcmPage3.answers[i])) ? 1 : 0;
        });
      }
    }
  } catch (e) {
    console.warn('⚠️ Récupération renforcée Page 3 impossible:', e);
  }`;

const legacyRecovery = `    console.log('✅ Réponses / Scores récupérés');
  } catch (e) {
    console.warn('⚠️ Erreur récupération réponses/scores:', e);
  }

  // Récupération renforcée Page 3 — Réception & Rangement.
  try {
    const dedicated = JSON.parse(sessionStorage.getItem('page3_resultats') || 'null');
    if (dedicated && dedicated.reponses) Object.assign(reponses, dedicated.reponses);
    if (dedicated && dedicated.scores) Object.assign(scores, dedicated.scores);

    const hasPage3 = Array.from({ length: 14 }, (_, index) => index + 1)
      .some(i => String(reponses['page3_q' + i] || '').trim() !== '');
    if (!hasPage3) {
      const drafts = JSON.parse(sessionStorage.getItem('seb_evalpro_qcm_drafts') || '{}') || {};
      const draft = drafts.page3;
      if (draft && Array.isArray(draft.values)) {
        draft.values.forEach(saved => {
          const match = String(saved && saved.id || '').match(/^reponse3_(\\d+)$/);
          if (!match) return;
          const i = Number(match[1]);
          if (i < 1 || i > 14) return;
          const value = String(saved.value == null ? '' : saved.value).trim();
          reponses['page3_q' + i] = value;
          scores['page3_q' + i] = (bonnesReponsesPage3[i] && value.toUpperCase() === String(bonnesReponsesPage3[i]).toUpperCase()) ? 1 : 0;
        });
      }
    }
  } catch (e) {
    console.warn('⚠️ Récupération renforcée Page 3 impossible:', e);
  }`;

if (!html.includes('Récupération renforcée Page 3')) {
  if (!html.includes(resultsLoadMarker)) fail('point de récupération Résultats stagiaire introuvable', 7);
  html = html.replace(resultsLoadMarker, modularPage3 ? modularRecovery : legacyRecovery);
}

const checks = [
  [html.includes("reponses = JSON.parse(sessionStorage.getItem('reponses_data')"), 'réhydratation globale'],
  [html.includes('const persistedResponses = JSON.parse'), 'fusion avant sauvegarde'],
  [html.includes('Récupération renforcée Page 3'), 'fallback Résultats stagiaire'],
  [html.includes("drafts.page3"), 'fallback brouillon Page 3']
];
if (modularPage3) {
  checks.push([moduleText.includes("sessionStorage.setItem(DEDICATED_KEY"), 'sauvegarde dédiée Page 3 modulaire']);
  checks.push([html.includes('seb_evalpro_qcm_page3_state'), 'fallback état canonique Page 3']);
} else {
  checks.push([html.includes("sessionStorage.setItem('page3_resultats'"), 'sauvegarde dédiée Page 3']);
}
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) fail('contrôles finaux échoués : ' + failed.join(', '), 8);

fs.writeFileSync(file, html, 'utf8');
console.log('SEB EvalPro TEST: Page 3 persistée/restaurée; grille verrouillée = 9h15, 8h50, 9h05, 9h20, 8h45, 5h15, 9h45, 9h15, 9h30, 9h55, 9h25, 2h35, 0h31, 1h03.');
