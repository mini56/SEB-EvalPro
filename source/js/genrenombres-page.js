(function () {
  'use strict';

  const ANSWERS_KEY = 'user_genrenombres';
  const ERRORS_KEY = 'erreurs_exercice';
  const DONE_KEY = 'seb_genrenombres_validated';
  const STATE_KEY = 'seb_evalpro_genrenombres_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_page_draft_genrenombres.html';
  const TOTAL = 20;

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function parseJson(value) {
    try { return JSON.parse(value || 'null'); } catch (_) { return null; }
  }

  function inputs() {
    return Array.from(document.querySelectorAll('input[data-answer]'));
  }

  function norm(value) {
    return String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .replace(/[’‘]/g, "'")
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('fr-FR');
  }

  function possibleAnswers(input) {
    return String(input?.dataset?.answer || '')
      .split('|')
      .map((answer) => answer.trim())
      .filter(Boolean);
  }

  function isCorrect(input, userValue) {
    const user = norm(userValue);
    return possibleAnswers(input).some((answer) => user === norm(answer));
  }

  function getUserAnswers() {
    return inputs().map((input) => String(input.value || '').trim());
  }

  function anyEntry(values) {
    const answers = Array.isArray(values) ? values : getUserAnswers();
    return answers.some((value) => String(value || '').trim() !== '');
  }

  function evaluate(values) {
    const answers = Array.isArray(values) ? values : getUserAnswers();
    let errors = 0;
    const details = inputs().map((input, index) => {
      const response = String(answers[index] == null ? '' : answers[index]).trim();
      const correct = isCorrect(input, response);
      if (!correct) errors += 1;
      return {
        index,
        reponse:response,
        attendu:String(input.dataset.answer || ''),
        correct
      };
    });
    return {
      answers,
      details,
      errors,
      score:TOTAL - errors,
      total:TOTAL
    };
  }

  function clearCorrectionDisplay() {
    inputs().forEach((input) => {
      input.style.background = '';
      input.style.borderColor = '';
    });
  }

  function afficherCorrection(result) {
    clearCorrectionDisplay();
    result.details.forEach((detail) => {
      const input = inputs()[detail.index];
      if (!input) return;
      if (detail.correct) {
        input.style.background = '#d4f7d4';
        input.style.borderColor = '#57b657';
      } else {
        input.style.background = '#f7d4d4';
        input.style.borderColor = '#d15b5b';
      }
    });
  }

  function applyAnswers(values) {
    if (!Array.isArray(values)) return false;
    inputs().forEach((input, index) => {
      if (values[index] !== undefined && values[index] !== null) input.value = String(values[index]);
    });
    return true;
  }

  function setUnlockedUi() {
    inputs().forEach((input) => { input.disabled = false; });
    const check = document.getElementById('btnCheck');
    const next = document.getElementById('btnNextGenreNombre');
    if (check) {
      check.disabled = false;
      check.style.removeProperty('display');
      check.removeAttribute('aria-hidden');
      check.removeAttribute('tabindex');
    }
    if (next) {
      next.disabled = false;
      next.style.setProperty('display', 'none', 'important');
      next.setAttribute('aria-hidden', 'true');
      next.tabIndex = -1;
    }
  }

  function lockAfterCheck() {
    inputs().forEach((input) => { input.disabled = true; });
    const check = document.getElementById('btnCheck');
    const next = document.getElementById('btnNextGenreNombre');
    if (check) {
      check.disabled = true;
      check.style.setProperty('display', 'none', 'important');
      check.setAttribute('aria-hidden', 'true');
      check.tabIndex = -1;
    }
    if (next) {
      next.disabled = false;
      next.classList.remove('seb-exercise-nav-locked');
      next.style.setProperty('display', 'inline-flex', 'important');
      next.setAttribute('aria-hidden', 'false');
      next.removeAttribute('tabindex');
    }
  }

  function persistState(validated) {
    const state = {
      answers:getUserAnswers(),
      validated:validated === undefined
        ? (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(ERRORS_KEY) !== null)
        : !!validated,
      savedAt:Date.now()
    };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    persistCandidate();
    return state;
  }

  function legacyDraftAnswers() {
    const draft = parseJson(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    if (!draft || !Array.isArray(draft.controls)) return null;
    const values = [];
    const textControls = draft.controls.filter((saved) => String(saved?.type || '') === 'text');
    if (!textControls.length) return null;
    textControls.slice(0, TOTAL).forEach((saved, index) => {
      values[index] = saved?.value == null ? '' : String(saved.value);
    });
    return values.length ? values : null;
  }

  function historicalAnswers() {
    const values = parseJson(sessionStorage.getItem(ANSWERS_KEY));
    return Array.isArray(values) ? values.slice(0, TOTAL) : null;
  }

  function restoreState() {
    const state = parseJson(sessionStorage.getItem(STATE_KEY));
    const storedAnswers = historicalAnswers();
    const validated = sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(ERRORS_KEY) !== null;

    if (state && Array.isArray(state.answers)) {
      applyAnswers(state.answers);
      if (state.validated || validated) {
        const result = evaluate(state.answers);
        afficherCorrection(result);
        sessionStorage.setItem(DONE_KEY, '1');
        lockAfterCheck();
        return { source:'canonical', validated:true };
      }
      setUnlockedUi();
      return { source:'canonical', validated:false };
    }

    if (storedAnswers) {
      applyAnswers(storedAnswers);
      const migrated = {
        answers:getUserAnswers(),
        validated,
        savedAt:Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      if (validated) {
        afficherCorrection(evaluate(migrated.answers));
        sessionStorage.setItem(DONE_KEY, '1');
        lockAfterCheck();
      } else {
        setUnlockedUi();
      }
      persistCandidate();
      return { source:'historical', validated };
    }

    const legacy = legacyDraftAnswers();
    if (legacy) {
      applyAnswers(legacy);
      const migrated = {
        answers:getUserAnswers(),
        validated,
        savedAt:Date.now()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(migrated));
      if (validated) {
        const result = evaluate(migrated.answers);
        sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(result.answers));
        if (sessionStorage.getItem(ERRORS_KEY) === null) sessionStorage.setItem(ERRORS_KEY, String(result.errors));
        sessionStorage.setItem(DONE_KEY, '1');
        afficherCorrection(result);
        lockAfterCheck();
      } else {
        setUnlockedUi();
      }
      persistCandidate();
      return { source:'legacy-draft', validated };
    }

    if (validated) {
      sessionStorage.setItem(DONE_KEY, '1');
      lockAfterCheck();
      return { source:'historical-errors', validated:true };
    }

    setUnlockedUi();
    return { source:'empty', validated:false };
  }

  function verify() {
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(ERRORS_KEY) !== null) {
      lockAfterCheck();
      return null;
    }

    const answers = getUserAnswers();
    if (!anyEntry(answers)) {
      window.alert('Commencez l’exercice avant de le vérifier. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
      return null;
    }

    const result = evaluate(answers);
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(result.answers));
    sessionStorage.setItem(ERRORS_KEY, String(result.errors));
    sessionStorage.setItem(DONE_KEY, '1');
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      answers:result.answers,
      validated:true,
      savedAt:Date.now()
    }));
    persistCandidate();

    afficherCorrection(result);
    lockAfterCheck();
    return result;
  }

  function goNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('genrenombres');
  }

  function onInput() {
    if (sessionStorage.getItem(DONE_KEY) === '1') return;
    persistState(false);
  }

  function installKeyboardNavigation() {
    const list = inputs();
    list.forEach((input, index) => {
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (input.disabled) return;
        const next = list[index + 1];
        if (next) next.focus();
        else verify();
      });
    });
  }

  function install() {
    restoreState();
    inputs().forEach((input) => input.addEventListener('input', onInput));
    document.getElementById('btnCheck')?.addEventListener('click', verify);
    document.getElementById('btnNextGenreNombre')?.addEventListener('click', goNext);
    installKeyboardNavigation();

    setTimeout(function () {
      restoreState();
    }, 0);
  }

  window.sebGenreNombre = Object.freeze({
    total:TOTAL,
    norm,
    possibleAnswers,
    isCorrect,
    getUserAnswers,
    anyEntry,
    evaluate,
    afficherCorrection,
    persistState,
    restoreState,
    verify,
    goNext
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
