(function () {
  'use strict';

  const SOLUTION = Object.freeze([
    Object.freeze([4, 3, 1, 2]),
    Object.freeze([2, 4, 3, 1]),
    Object.freeze([3, 1, 2, 4]),
    Object.freeze([1, 2, 4, 3])
  ]);

  let errorCount = 0;
  let isValidated = false;

  function cellAt(row, col) {
    return document.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  }

  function getGrid() {
    const grid = [];
    for (let row = 0; row < 4; row += 1) {
      grid[row] = [];
      for (let col = 0; col < 4; col += 1) {
        const cell = cellAt(row, col);
        grid[row][col] = cell && cell.value ? parseInt(cell.value, 10) : 0;
      }
    }
    return grid;
  }

  function saveResult(errors) {
    const score = 16 - errors;
    sessionStorage.setItem('puzzleErrors', String(errors));
    sessionStorage.setItem('carre_magique_score', String(score));
    sessionStorage.setItem('carre_magique_erreurs', String(errors));
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    console.log('✅ Carré magique sauvegardé :', { score, erreurs:errors });
    return { score, erreurs:errors };
  }

  function lockAfterValidation() {
    // SEB_CARRE_LOCK95 : aucune seconde tentative après affichage des réponses.
    document.querySelectorAll('.cell').forEach((cell) => { cell.disabled = true; });
    const resetButton = document.querySelector('.btn-reset');
    if (resetButton) {
      resetButton.disabled = true;
      resetButton.style.display = 'none';
    }
    const validateButton = document.getElementById('btnValidate');
    if (validateButton) {
      validateButton.disabled = true;
      validateButton.style.display = 'none';
    }
    document.getElementById('btnNext')?.classList.add('show');
  }

  function validatePuzzle() {
    if (isValidated) return saveResult(errorCount);

    errorCount = 0;
    document.querySelectorAll('.cell').forEach((cell) => {
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      const userValue = cell.value ? parseInt(cell.value, 10) : 0;
      cell.classList.remove('correct-answer', 'wrong-answer');
      if (userValue === SOLUTION[row][col]) {
        cell.classList.add('correct-answer');
      } else {
        cell.classList.add('wrong-answer');
        errorCount += 1;
      }
    });

    const result = saveResult(errorCount);
    isValidated = true;
    lockAfterValidation();
    return result;
  }

  function resetPuzzle() {
    if (isValidated) return;
    document.querySelectorAll('.cell').forEach((cell) => {
      cell.value = '';
      cell.disabled = false;
      cell.classList.remove('correct-answer', 'wrong-answer');
    });
    errorCount = 0;
    document.getElementById('btnValidate')?.style.removeProperty('display');
    document.getElementById('btnNext')?.classList.remove('show');
  }

  function showSolution() {
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const cell = cellAt(row, col);
        if (cell) cell.value = String(SOLUTION[row][col]);
      }
    }
  }

  function navigateNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('carre');
  }

  function installCellBehaviour() {
    document.querySelectorAll('.cell').forEach((cell) => {
      cell.addEventListener('input', (event) => {
        const value = event.target.value;
        if (value && (value < '1' || value > '4')) event.target.value = '';
      });
      cell.addEventListener('keydown', function (event) {
        const row = parseInt(this.dataset.row, 10);
        const col = parseInt(this.dataset.col, 10);
        let newRow = row;
        let newCol = col;
        if (event.key === 'ArrowUp' && row > 0) newRow -= 1;
        else if (event.key === 'ArrowDown' && row < 3) newRow += 1;
        else if (event.key === 'ArrowLeft' && col > 0) newCol -= 1;
        else if (event.key === 'ArrowRight' && col < 3) newCol += 1;
        else return;
        event.preventDefault();
        cellAt(newRow, newCol)?.focus();
      });
    });
  }

  function install() {
    // Comportement historique conservé : cette donnée d'affichage est recalculée
    // à chaque nouvelle entrée dans l'exercice.
    sessionStorage.removeItem('puzzleErrors');

    installCellBehaviour();
    document.querySelector('.btn-reset')?.addEventListener('click', resetPuzzle);
    document.getElementById('btnValidate')?.addEventListener('click', validatePuzzle);
    document.getElementById('btnNext')?.addEventListener('click', navigateNext);
  }

  const api = Object.freeze({
    solution:SOLUTION,
    getGrid,
    validatePuzzle,
    resetPuzzle,
    showSolution,
    navigateNext,
    saveResult
  });
  window.sebCarre = api;

  // Compatibilité transitoire avec les couches historiques.
  window.validate = validatePuzzle;
  window.reset = resetPuzzle;
  window.showSolution = showSolution;
  window.goToNextPage = navigateNext;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
