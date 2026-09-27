(function () {
  'use strict';

  const SCORE_KEY = 'paronymes_score';
  const TOTAL_KEY = 'paronymes_total';
  const RESPONSES_KEY = 'paronymes_reponses';
  const ERRORS_KEY = 'paronymes_erreurs_detail';
  const DONE_KEY = 'seb_paronymes_validated';
  const ACTIVITY_KEY = 'seb_exercise_activity:paronymes.html';

  function rows() {
    return Array.from(document.querySelectorAll('tr')).filter((row) => row.querySelector('.paronyme'));
  }

  function answerCells(row) {
    return Array.from(row.querySelectorAll('td:not(.paronyme)'));
  }

  function hasSelection() {
    return !!document.querySelector('td:not(.paronyme).selected');
  }

  function lockAnswers() {
    rows().forEach((row) => {
      answerCells(row).forEach((cell) => {
        cell.style.cursor = 'default';
        cell.style.pointerEvents = 'none';
        cell.setAttribute('aria-disabled', 'true');
      });
    });
  }

  function ensureNextButton() {
    let next = document.getElementById('btnNextParonymes');
    if (!next) {
      next = document.createElement('button');
      next.id = 'btnNextParonymes';
      next.className = 'btn';
      next.type = 'button';
      next.textContent = 'Suivant →';
      const check = document.getElementById('btnCheck');
      const parent = check?.parentElement || document.querySelector('.footer');
      if (parent) parent.appendChild(next);
      next.addEventListener('click', navigateNext);
    }
    return next;
  }

  function hideNextButton() {
    const next = ensureNextButton();
    if (!next) return;
    next.style.setProperty('display', 'none', 'important');
    next.setAttribute('aria-hidden', 'true');
    next.tabIndex = -1;
  }

  function showNextButton() {
    const next = ensureNextButton();
    if (!next) return;
    next.disabled = false;
    next.classList.remove('seb-exercise-nav-locked');
    next.style.setProperty('display', 'inline-flex', 'important');
    next.setAttribute('aria-hidden', 'false');
    next.removeAttribute('tabindex');
  }

  function hideCheckButton() {
    const check = document.getElementById('btnCheck');
    if (!check) return;
    check.disabled = true;
    check.style.setProperty('display', 'none', 'important');
    check.setAttribute('aria-hidden', 'true');
    check.tabIndex = -1;
  }

  function selectCell(cell) {
    if (!cell || cell.classList.contains('correct-answer') || cell.classList.contains('wrong-answer')) return;
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(SCORE_KEY) !== null) return;

    const row = cell.parentElement;
    answerCells(row).forEach((other) => other.classList.remove('selected'));
    cell.classList.add('selected');
    sessionStorage.setItem(ACTIVITY_KEY, '1');
  }

  function calculateAndPersist() {
    let score = 0;
    let total = 0;
    const responses = [];

    rows().forEach((row) => {
      const paronyme = row.querySelector('.paronyme');
      const selected = row.querySelector('td.selected');
      const corrects = Array.from(row.querySelectorAll('td[data-correct="true"]'));
      total += 1;

      const correctAnswers = corrects.map((cell) => cell.textContent.trim());
      let userAnswer = '(non repondu)';
      let isCorrect = false;

      if (selected) {
        userAnswer = selected.textContent.trim();
        isCorrect = corrects.includes(selected);
        if (isCorrect) {
          selected.classList.add('correct-answer');
          selected.classList.remove('wrong-answer', 'selected');
          score += 1;
        } else {
          selected.classList.add('wrong-answer');
          selected.classList.remove('correct-answer', 'selected');
          corrects.forEach((cell) => cell.classList.add('correct-answer'));
        }
      } else {
        corrects.forEach((cell) => cell.classList.add('correct-answer'));
      }

      responses.push({
        paronyme: paronyme.textContent.trim(),
        reponseUtilisateur: userAnswer,
        bonnesReponses: correctAnswers,
        correct: isCorrect
      });
    });

    sessionStorage.setItem(SCORE_KEY, String(score));
    sessionStorage.setItem(TOTAL_KEY, String(total));
    sessionStorage.setItem(RESPONSES_KEY, JSON.stringify(responses));
    sessionStorage.setItem(ERRORS_KEY, JSON.stringify(responses.filter((response) => !response.correct)));
    sessionStorage.setItem(DONE_KEY, '1');
    sessionStorage.setItem(ACTIVITY_KEY, '1');

    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    return { score, total, responses };
  }

  function finishValidation() {
    lockAnswers();
    hideCheckButton();
    showNextButton();
  }

  function validate() {
    if (sessionStorage.getItem(DONE_KEY) === '1' || sessionStorage.getItem(SCORE_KEY) !== null) {
      finishValidation();
      return null;
    }

    if (!hasSelection()) {
      window.alert('Commencez l’exercice avant de le vérifier. Si vous ne souhaitez pas le réaliser, utilisez « Abandonner l’exercice ».');
      return null;
    }

    const result = calculateAndPersist();
    finishValidation();
    window.alert('Score : ' + result.score + ' / ' + result.total);
    return result;
  }

  function restoreValidatedState() {
    if (sessionStorage.getItem(DONE_KEY) !== '1' && sessionStorage.getItem(SCORE_KEY) === null) {
      hideNextButton();
      return false;
    }

    let responses = [];
    try { responses = JSON.parse(sessionStorage.getItem(RESPONSES_KEY) || '[]'); } catch (_) {}
    const responseByWord = new Map(
      Array.isArray(responses) ? responses.map((response) => [String(response?.paronyme || ''), response]) : []
    );

    rows().forEach((row) => {
      const word = row.querySelector('.paronyme')?.textContent.trim() || '';
      const response = responseByWord.get(word);
      const corrects = Array.from(row.querySelectorAll('td[data-correct="true"]'));
      const cells = answerCells(row);
      cells.forEach((cell) => cell.classList.remove('selected', 'correct-answer', 'wrong-answer'));

      if (response) {
        if (response.reponseUtilisateur && response.reponseUtilisateur !== '(non repondu)') {
          const chosen = cells.find((cell) => cell.textContent.trim() === response.reponseUtilisateur);
          if (chosen) chosen.classList.add(response.correct ? 'correct-answer' : 'wrong-answer');
        }
        if (!response.correct) corrects.forEach((cell) => cell.classList.add('correct-answer'));
      }
    });

    sessionStorage.setItem(DONE_KEY, '1');
    finishValidation();
    return true;
  }

  function navigateNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('paronymes');
  }

  function install() {
    rows().forEach((row) => {
      answerCells(row).forEach((cell) => cell.addEventListener('click', () => selectCell(cell)));
    });
    document.getElementById('btnCheck')?.addEventListener('click', validate);
    ensureNextButton();
    restoreValidatedState();
  }

  const api = Object.freeze({
    rows,
    hasSelection,
    selectCell,
    validate,
    restoreValidatedState,
    navigateNext
  });
  window.sebParonymes = api;
  window.verifierReponses = validate;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
