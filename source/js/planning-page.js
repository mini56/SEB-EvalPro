(function () {
  'use strict';

  const SCORE_KEY = 'planningScore';
  const CORRECTION_KEY = 'planningCorrection';
  const STATE_KEY = 'seb_evalpro_planning_state';
  const DONE_KEY = 'seb_planning_validated';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_page_draft_planning.html';
  const TOTAL = 15;

  const solutions = Object.freeze({
    q1:'Lizig👱🏼‍♀️',
    q2:'Katell👩🏻‍🦱',
    q3:'Lizig👱🏼‍♀️',
    q4:'Katell👩🏻‍🦱',
    q5:'Katell👩🏻‍🦱',
    q6:'Assiette de fruits de mer',
    q7:'Spaghettis',
    q8:'Pavé de saumon',
    q9:'Galettes au blé noir',
    q10:'Kig-Ha-Farz',
    q11:'Crème brûlée',
    q12:'Profiteroles',
    q13:'Tarte au citron',
    q14:'Crumble aux fruits rouges',
    q15:'Kouign-Amann'
  });

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function parseJson(value) {
    try { return JSON.parse(value || 'null'); } catch (_) { return null; }
  }

  function fieldIds() {
    return Array.from({ length:TOTAL }, (_, index) => 'q' + (index + 1));
  }

  function getUser() {
    const answers = {};
    fieldIds().forEach((id) => {
      answers[id] = document.getElementById(id)?.value || '_';
    });
    return answers;
  }

  function anyPlanningEntry(answers) {
    const data = answers || getUser();
    return fieldIds().some((id) => {
      const value = String(data[id] == null ? '' : data[id]).trim();
      return value !== '' && value !== '_';
    });
  }

  function correct(user) {
    const correction = {};
    fieldIds().forEach((id) => {
      const response = user[id] == null ? '_' : String(user[id]);
      correction[id] = {
        reponse:response,
        attendu:solutions[id],
        correct:response === solutions[id]
      };
    });
    return correction;
  }

  function scoreCorrection(correction) {
    return fieldIds().reduce((score, id) => score + (correction[id]?.correct ? 1 : 0), 0);
  }

  function clearCorrectionDisplay() {
    fieldIds().forEach((id) => {
      const select = document.getElementById(id);
      if (select?.parentElement) select.parentElement.style.boxShadow = '';
    });
  }

  function afficherCorrection(correction) {
    clearCorrectionDisplay();
    fieldIds().forEach((id) => {
      const select = document.getElementById(id);
      if (!select?.parentElement) return;
      select.parentElement.style.boxShadow = correction[id]?.correct
        ? '0 0 0 3px #22c55e inset'
        : '0 0 0 3px #ef4444 inset';
    });
  }

  function applyAnswers(answers) {
    if (!answers) return false;
    fieldIds().forEach((id) => {
      const select = document.getElementById(id);
      const value = answers[id];
      if (!select || value === undefined || value === null) return;
      const desired = String(value).replace(/^Spaghetti$/, 'Spaghettis');
      const option = Array.from(select.options).find((item) => item.value === desired || item.text === desired);
      if (option) select.value = option.value;
    });
    return true;
  }

  function persistState(validated) {
    const current = parseJson(sessionStorage.getItem(STATE_KEY)) || {};
    const state = {
      answers:getUser(),
      validated:validated === undefined ? !!current.validated : !!validated,
      savedAt:Date.now()
    };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    persistCandidate();
    return state;
  }

  function lockPlanning() {
    document.querySelectorAll('select[id^="q"]').forEach((select) => { select.disabled = true; });
    const validate = document.getElementById('btnValider');
    if (validate) {
      validate.disabled = true;
      validate.style.setProperty('display', 'none', 'important');
      validate.setAttribute('aria-hidden', 'true');
      validate.tabIndex = -1;
    }
    const next = document.getElementById('btnSuivant');
    if (next) {
      next.disabled = false;
      next.classList.remove('seb-exercise-nav-locked');
      next.style.setProperty('display', 'inline-flex', 'important');
      next.setAttribute('aria-hidden', 'false');
      next.removeAttribute('tabindex');
    }
  }

  function unlockPlanning() {
    document.querySelectorAll('select[id^="q"]').forEach((select) => { select.disabled = false; });
    const validate = document.getElementById('btnValider');
    if (validate) {
      validate.disabled = false;
      validate.style.removeProperty('display');
      validate.removeAttribute('aria-hidden');
      validate.removeAttribute('tabindex');
    }
    const next = document.getElementById('btnSuivant');
    if (next) {
      next.style.display = 'none';
      next.setAttribute('aria-hidden', 'true');
    }
  }

  function legacyDraftAnswers() {
    const draft = parseJson(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    if (!draft || !Array.isArray(draft.controls)) return null;
    const answers = {};
    draft.controls.forEach((saved) => {
      const id = String(saved?.id || '');
      if (!/^q(?:[1-9]|1[0-5])$/.test(id)) return;
      if (saved.value !== undefined && saved.value !== null) {
        answers[id] = String(saved.value).replace(/^Spaghetti$/, 'Spaghettis');
      }
    });
    return Object.keys(answers).length ? answers : null;
  }

  function correctionAnswers(correction) {
    if (!correction || typeof correction !== 'object') return null;
    const answers = {};
    fieldIds().forEach((id) => {
      if (correction[id] && correction[id].reponse !== undefined) {
        answers[id] = String(correction[id].reponse).replace(/^Spaghetti$/, 'Spaghettis');
      }
    });
    return Object.keys(answers).length ? answers : null;
  }

  function restoreState() {
    const state = parseJson(sessionStorage.getItem(STATE_KEY));
    const correction = parseJson(sessionStorage.getItem(CORRECTION_KEY));
    const historicalValidated = sessionStorage.getItem(DONE_KEY) === '1' ||
      sessionStorage.getItem(SCORE_KEY) !== null;

    if (state && state.answers) {
      applyAnswers(state.answers);
      if (state.validated || historicalValidated) {
        const corr = correction || correct(state.answers);
        afficherCorrection(corr);
        sessionStorage.setItem(DONE_KEY, '1');
        lockPlanning();
        return { source:'canonical', validated:true };
      }
      unlockPlanning();
      return { source:'canonical', validated:false };
    }

    const historicalAnswers = correctionAnswers(correction);
    if (historicalAnswers) {
      applyAnswers(historicalAnswers);
      const migrated = {
        answers:getUser(),
        validated:historicalValidated,
        savedAt:Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      if (historicalValidated) {
        afficherCorrection(correction || correct(migrated.answers));
        sessionStorage.setItem(DONE_KEY, '1');
        lockPlanning();
      } else {
        unlockPlanning();
      }
      persistCandidate();
      return { source:'correction', validated:historicalValidated };
    }

    const legacyAnswers = legacyDraftAnswers();
    if (legacyAnswers) {
      applyAnswers(legacyAnswers);
      const migrated = {
        answers:getUser(),
        validated:historicalValidated,
        savedAt:Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      if (historicalValidated) {
        const corr = correct(migrated.answers);
        if (!correction) sessionStorage.setItem(CORRECTION_KEY, JSON.stringify(corr));
        afficherCorrection(correction || corr);
        sessionStorage.setItem(DONE_KEY, '1');
        lockPlanning();
      } else {
        unlockPlanning();
      }
      persistCandidate();
      return { source:'legacy-draft', validated:historicalValidated };
    }

    if (historicalValidated) {
      sessionStorage.setItem(DONE_KEY, '1');
      lockPlanning();
      return { source:'historical-score', validated:true };
    }

    unlockPlanning();
    return { source:'empty', validated:false };
  }

  function validatePlanning() {
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(SCORE_KEY) !== null) {
      lockPlanning();
      return null;
    }

    const user = getUser();
    if (!anyPlanningEntry(user)) {
      window.alert('Commencez l’exercice avant de le valider. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
      return null;
    }

    const correction = correct(user);
    const score = scoreCorrection(correction);

    sessionStorage.setItem(SCORE_KEY, String(score));
    sessionStorage.setItem(CORRECTION_KEY, JSON.stringify(correction));
    sessionStorage.setItem(DONE_KEY, '1');
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      answers:user,
      validated:true,
      savedAt:Date.now()
    }));
    persistCandidate();

    afficherCorrection(correction);
    lockPlanning();
    window.alert('Planning validé ! Score : ' + score + '/' + TOTAL);
    return { score, correction, total:TOTAL };
  }

  function goNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('planning');
  }

  function onSelectionChange() {
    if (sessionStorage.getItem(DONE_KEY) === '1') return;
    persistState(false);
  }

  function install() {
    restoreState();

    fieldIds().forEach((id) => {
      document.getElementById(id)?.addEventListener('change', onSelectionChange);
    });
    document.getElementById('btnValider')?.addEventListener('click', validatePlanning);
    document.getElementById('btnSuivant')?.addEventListener('click', goNext);

    // La reprise générique historique se déclenche aussi sur DOMContentLoaded.
    // Le contrôleur Planning réapplique ensuite son état canonique.
    setTimeout(function () {
      restoreState();
    }, 0);
  }

  window.sebPlanning = Object.freeze({
    solutions,
    total:TOTAL,
    getUser,
    anyPlanningEntry,
    correct,
    scoreCorrection,
    afficherCorrection,
    persistState,
    restoreState,
    validatePlanning,
    goNext
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
