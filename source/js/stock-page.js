(function () {
  'use strict';

  const CORRECT_KEY = 'stockCorrect';
  const ERROR_KEY = 'stockErrors';
  const TOTAL_KEY = 'stockTotal';
  const STATE_KEY = 'seb_evalpro_stock_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_page_draft_stock.html';
  const TOTAL_EVALUATED = 33;
  const EXAMPLE_ID = '8';

  const pots = Object.freeze([
    { id:1, code:'Ow', percentage:37, color:'rouge' },
    { id:2, code:'To', percentage:87, color:'bleu' },
    { id:3, code:'Ba', percentage:28, color:'orange' },
    { id:4, code:'Sa', percentage:21, color:'vert' },
    { id:5, code:'Lu', percentage:28, color:'violet' },
    { id:6, code:'Ba', percentage:28, color:'jaune' },
    { id:7, code:'Uv', percentage:31, color:'rouge' },
    { id:8, code:'Ab', percentage:62, color:'orange' },
    { id:9, code:'Lu', percentage:28, color:'jaune' },
    { id:10, code:'Ma', percentage:52, color:'violet' },
    { id:11, code:'Ab', percentage:22, color:'vert' },
    { id:12, code:'Ab', percentage:50, color:'jaune' },
    { id:13, code:'Ac', percentage:30, color:'rouge' },
    { id:14, code:'Du', percentage:70, color:'vert' },
    { id:15, code:'Kr', percentage:60, color:'orange' },
    { id:16, code:'Qa', percentage:89, color:'rouge' },
    { id:17, code:'Ma', percentage:29, color:'bleu' },
    { id:18, code:'Ni', percentage:55, color:'jaune' },
    { id:19, code:'Pa', percentage:47, color:'orange' },
    { id:20, code:'Qa', percentage:12, color:'vert' },
    { id:21, code:'Gi', percentage:55, color:'rouge' },
    { id:22, code:'Lu', percentage:28, color:'jaune' },
    { id:23, code:'Ju', percentage:27, color:'bleu' },
    { id:24, code:'Gi', percentage:12, color:'violet' },
    { id:25, code:'Ux', percentage:31, color:'orange' },
    { id:26, code:'Lu', percentage:18, color:'rouge' },
    { id:27, code:'Fa', percentage:90, color:'bleu' },
    { id:28, code:'Lu', percentage:53, color:'jaune' },
    { id:29, code:'Ju', percentage:20, color:'vert' },
    { id:30, code:'Et', percentage:12, color:'violet' },
    { id:31, code:'Ju', percentage:26, color:'orange' },
    { id:32, code:'Ma', percentage:11, color:'bleu' },
    { id:33, code:'Ne', percentage:31, color:'jaune' },
    { id:34, code:'Ni', percentage:62, color:'rouge' }
  ]);

  const exactPlacements = Object.freeze({
    'Ab-62': Object.freeze([{ etagere:1, niveau:1, case:1 }]),
    'Du-70': Object.freeze([{ etagere:1, niveau:1, case:2 }]),
    'Fa-90': Object.freeze([{ etagere:1, niveau:1, case:3 }]),
    'Kr-60': Object.freeze([{ etagere:1, niveau:1, case:4 }]),

    'Ab-50': Object.freeze([{ etagere:1, niveau:2, case:1 }]),
    'Ac-30': Object.freeze([{ etagere:1, niveau:2, case:2 }]),
    'Ba-28': Object.freeze([
      { etagere:1, niveau:2, case:3 },
      { etagere:3, niveau:1, case:1 }
    ]),
    'Ju-27': Object.freeze([{ etagere:1, niveau:2, case:4 }]),

    'Ab-22': Object.freeze([{ etagere:1, niveau:3, case:1 }]),
    'Ju-26': Object.freeze([{ etagere:1, niveau:3, case:2 }]),
    'Ju-20': Object.freeze([{ etagere:1, niveau:3, case:3 }]),

    'Ni-62': Object.freeze([{ etagere:2, niveau:1, case:1 }]),
    'Ni-55': Object.freeze([{ etagere:2, niveau:1, case:2 }]),
    'Qa-89': Object.freeze([{ etagere:2, niveau:1, case:3 }]),
    'To-87': Object.freeze([{ etagere:2, niveau:1, case:4 }]),

    'Lu-53': Object.freeze([{ etagere:2, niveau:2, case:1 }]),
    'Ne-31': Object.freeze([{ etagere:2, niveau:2, case:2 }]),
    'Uv-31': Object.freeze([{ etagere:2, niveau:2, case:3 }]),
    'Ux-31': Object.freeze([{ etagere:2, niveau:2, case:4 }]),

    'Lu-28': Object.freeze([
      { etagere:2, niveau:3, case:1 },
      { etagere:3, niveau:1, case:5 },
      { etagere:3, niveau:1, case:6 }
    ]),
    'Lu-18': Object.freeze([{ etagere:2, niveau:3, case:2 }]),
    'Qa-12': Object.freeze([{ etagere:2, niveau:3, case:3 }]),
    'Sa-21': Object.freeze([{ etagere:2, niveau:3, case:4 }]),

    'Et-12': Object.freeze([{ etagere:3, niveau:1, case:2 }]),
    'Gi-55': Object.freeze([{ etagere:3, niveau:1, case:3 }]),
    'Gi-12': Object.freeze([{ etagere:3, niveau:1, case:4 }]),
    'Ma-52': Object.freeze([{ etagere:3, niveau:1, case:7 }]),
    'Ma-29': Object.freeze([{ etagere:3, niveau:1, case:8 }]),
    'Ma-11': Object.freeze([{ etagere:3, niveau:1, case:9 }]),
    'Ow-37': Object.freeze([{ etagere:3, niveau:1, case:10 }]),
    'Pa-47': Object.freeze([{ etagere:3, niveau:1, case:11 }])
  });

  let draggedElement = null;
  let draggedPlaceholder = null;
  let insertPlaceholder = null;

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function parseJson(value) {
    try { return JSON.parse(value || 'null'); } catch (_) { return null; }
  }

  function potElement(id) {
    return document.querySelector('.pot[data-pot-id="' + String(id) + '"]');
  }

  function caseElement(position) {
    if (!position) return null;
    return document.querySelector(
      '[data-etagere="' + String(position.etagere) + '"][data-niveau="' + String(position.niveau) + '"] .case[data-case="' + String(position.case) + '"]'
    );
  }

  function clearCaseOccupancy() {
    document.querySelectorAll('.case').forEach((node) => node.classList.remove('occupied', 'drag-over'));
  }

  function updateCaseOccupancy() {
    document.querySelectorAll('.case').forEach((node) => {
      node.classList.toggle('occupied', !!node.querySelector('.pot'));
    });
  }

  function createPots() {
    const source = document.getElementById('pots-source');
    if (!source) throw new Error('Zone des pots introuvable.');
    if (source.querySelector('.pot')) return;

    pots.forEach((pot) => {
      const element = document.createElement('div');
      element.className = 'pot';
      element.draggable = true;
      element.dataset.potId = String(pot.id);
      element.dataset.code = pot.code;
      element.dataset.percentage = String(pot.percentage);
      if (String(pot.id) === EXAMPLE_ID) element.dataset.sebExample = 'true';
      element.style.backgroundImage = 'url("flacon/flacon_' + pot.color + '.png")';
      element.innerHTML =
        '<div class="pot-code">' + pot.code + '</div>' +
        '<div class="pot-percent">' + pot.percentage + '%</div>';
      source.appendChild(element);
    });
  }

  function positionOf(pot) {
    const parent = pot && pot.parentElement;
    if (!parent) return { id:String(pot?.dataset?.potId || ''), type:'source', index:0 };
    const id = String(pot.dataset.potId || '');
    if (parent.classList.contains('case')) {
      const level = parent.closest('[data-etagere][data-niveau]');
      return {
        id,
        type:'case',
        etagere:String(level?.dataset.etagere || ''),
        niveau:String(level?.dataset.niveau || ''),
        caseNum:String(parent.dataset.case || '')
      };
    }
    if (parent.id === 'zone-tri') {
      return { id, type:'tri', index:Array.from(parent.querySelectorAll('.pot')).indexOf(pot) };
    }
    return { id, type:'source', index:Array.from(document.getElementById('pots-source')?.querySelectorAll('.pot') || []).indexOf(pot) };
  }

  function capturePositions() {
    return Array.from(document.querySelectorAll('.pot')).map(positionOf);
  }

  function hasStoredResult() {
    return sessionStorage.getItem(TOTAL_KEY) !== null &&
      sessionStorage.getItem(CORRECT_KEY) !== null;
  }

  function persistState(validated) {
    const state = {
      positions:capturePositions(),
      validated:validated === undefined ? hasStoredResult() : !!validated,
      savedAt:Date.now()
    };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    persistCandidate();
    return state;
  }

  function resetPotsToSource() {
    const source = document.getElementById('pots-source');
    const all = Array.from(document.querySelectorAll('.pot')).sort((a, b) => Number(a.dataset.potId) - Number(b.dataset.potId));
    clearCaseOccupancy();
    all.forEach((pot) => {
      pot.classList.remove('correct', 'incorrect', 'dragging');
      source.appendChild(pot);
    });
  }

  function restorePositions(items) {
    if (!Array.isArray(items)) return false;
    const source = document.getElementById('pots-source');
    const tri = document.getElementById('zone-tri');
    if (!source || !tri) return false;

    resetPotsToSource();

    items.filter((item) => item && item.type === 'case').forEach((item) => {
      const pot = potElement(item.id);
      const target = caseElement({ etagere:item.etagere, niveau:item.niveau, case:item.caseNum });
      if (!pot || !target || target.querySelector('.pot')) return;
      target.appendChild(pot);
    });

    const sourceItems = items.filter((item) => item && item.type === 'source').sort((a,b) => Number(a.index) - Number(b.index));
    sourceItems.forEach((item) => {
      const pot = potElement(item.id);
      if (pot) source.appendChild(pot);
    });

    const triItems = items.filter((item) => item && item.type === 'tri').sort((a,b) => Number(a.index) - Number(b.index));
    triItems.forEach((item) => {
      const pot = potElement(item.id);
      if (pot) tri.appendChild(pot);
    });

    updateCaseOccupancy();
    return true;
  }

  function defaultExample() {
    const example = potElement(EXAMPLE_ID);
    const target = caseElement({ etagere:1, niveau:1, case:1 });
    if (!example || !target || target.querySelector('.pot')) return false;
    target.appendChild(example);
    updateCaseOccupancy();
    return true;
  }

  function resultFromStorage() {
    if (!hasStoredResult()) return null;
    return {
      correct:Number(sessionStorage.getItem(CORRECT_KEY) || 0),
      errors:Number(sessionStorage.getItem(ERROR_KEY) || 0),
      total:Number(sessionStorage.getItem(TOTAL_KEY) || TOTAL_EVALUATED)
    };
  }

  function restoreState() {
    const state = parseJson(sessionStorage.getItem(STATE_KEY));
    if (state && Array.isArray(state.positions)) {
      restorePositions(state.positions);
      return { restored:true, validated:!!state.validated || hasStoredResult(), source:'canonical' };
    }

    const legacy = parseJson(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    if (legacy && Array.isArray(legacy.stock)) {
      restorePositions(legacy.stock);
      const migrated = persistState(!!legacy.stockValidated || hasStoredResult());
      return { restored:true, validated:!!migrated.validated, source:'legacy' };
    }

    defaultExample();
    return { restored:false, validated:hasStoredResult(), source:'default' };
  }

  function positionsForPot(pot) {
    if (!pot) return [];
    const key = String(pot.dataset.code || '') + '-' + String(pot.dataset.percentage || '');
    return exactPlacements[key] ? Array.from(exactPlacements[key], (entry) => ({ ...entry })) : [];
  }

  function getCorrectPosition(code, percentage) {
    const key = String(code || '') + '-' + String(percentage || '');
    const list = exactPlacements[key] || [];
    if (!list.length) return null;
    const copy = Array.from(list, (entry) => ({ ...entry }));
    return copy.length === 1 ? copy[0] : copy;
  }

  function isCorrectPlacement(pot) {
    const parent = pot?.parentElement;
    if (!parent || !parent.classList.contains('case')) return false;
    const level = parent.closest('[data-etagere][data-niveau]');
    if (!level) return false;

    const actual = {
      etagere:Number(level.dataset.etagere),
      niveau:Number(level.dataset.niveau),
      case:Number(parent.dataset.case)
    };
    return positionsForPot(pot).some((pos) =>
      Number(pos.etagere) === actual.etagere &&
      Number(pos.niveau) === actual.niveau &&
      Number(pos.case) === actual.case
    );
  }

  function computeScore(mark) {
    let correct = 0;
    let errors = 0;
    const candidates = Array.from(document.querySelectorAll('.pot:not([data-seb-example="true"])'));

    candidates.forEach((pot) => {
      if (mark) pot.classList.remove('correct', 'incorrect');
      if (isCorrectPlacement(pot)) {
        correct += 1;
        if (mark) pot.classList.add('correct');
      } else {
        errors += 1;
        if (mark) pot.classList.add('incorrect');
      }
    });

    return { correct, errors, total:TOTAL_EVALUATED };
  }

  function setVerifyMode() {
    const button = document.getElementById('stockActionBtn');
    if (!button) return;
    button.textContent = '🔍 Vérifier';
    button.onclick = null;
    button.addEventListener('click', verifyPlacements, { once:true });
  }

  function setNextMode() {
    const button = document.getElementById('stockActionBtn');
    if (!button) return;
    button.textContent = '➡️ Suivant';
    button.onclick = null;
    const replacement = button.cloneNode(true);
    button.replaceWith(replacement);
    replacement.addEventListener('click', goNext);
  }

  function verifyPlacements() {
    const score = computeScore(true);
    sessionStorage.setItem(CORRECT_KEY, String(score.correct));
    sessionStorage.setItem(ERROR_KEY, String(score.errors));
    sessionStorage.setItem(TOTAL_KEY, String(TOTAL_EVALUATED));
    persistState(true);
    window.alert(
      '✅ Flacons correctement placés : ' + score.correct + ' / ' + TOTAL_EVALUATED +
      '\n❌ Erreurs : ' + score.errors
    );
    setNextMode();
    return score;
  }

  function goNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('stock');
  }

  function cleanupPlaceholders() {
    if (draggedPlaceholder) {
      draggedPlaceholder.remove();
      draggedPlaceholder = null;
    }
    if (insertPlaceholder) {
      insertPlaceholder.remove();
      insertPlaceholder = null;
    }
  }

  function movePotToElement(pot, target, before) {
    if (!pot || !target) return false;
    const oldParent = pot.parentElement;
    if (target.classList?.contains('case') && target.querySelector('.pot') && target.querySelector('.pot') !== pot) return false;

    if (oldParent?.classList?.contains('case')) oldParent.classList.remove('occupied');
    pot.classList.remove('correct', 'incorrect');

    if (before && before.parentElement === target) target.insertBefore(pot, before);
    else target.appendChild(pot);

    updateCaseOccupancy();
    return true;
  }

  function placePot(potId, position, save) {
    const pot = potElement(potId);
    const target = caseElement(position);
    if (!pot || !target) return false;
    const moved = movePotToElement(pot, target);
    if (moved && save !== false) persistState();
    return moved;
  }

  function getDragAfterElement(container, x) {
    const elements = Array.from(container.querySelectorAll('.pot:not(.dragging), .pot-placeholder'))
      .filter((element) => !element.classList.contains('insert-placeholder'));

    return elements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element:child };
      return closest;
    }, { offset:Number.NEGATIVE_INFINITY, element:null }).element;
  }

  function installDragAndDrop() {
    const source = document.getElementById('pots-source');
    const tri = document.getElementById('zone-tri');

    document.addEventListener('dragstart', (event) => {
      const pot = event.target?.closest?.('.pot');
      if (!pot) return;
      draggedElement = pot;
      const parent = pot.parentElement;
      pot.classList.add('dragging');

      if (parent?.id === 'zone-tri') {
        draggedPlaceholder = document.createElement('div');
        draggedPlaceholder.className = 'pot-placeholder';
        parent.insertBefore(draggedPlaceholder, pot.nextSibling);
      }
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    document.addEventListener('dragend', (event) => {
      const pot = event.target?.closest?.('.pot');
      if (pot) pot.classList.remove('dragging');
      cleanupPlaceholders();
      draggedElement = null;
    });

    document.querySelectorAll('.case').forEach((targetCase) => {
      targetCase.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (!targetCase.classList.contains('occupied')) targetCase.classList.add('drag-over');
      });
      targetCase.addEventListener('dragleave', () => targetCase.classList.remove('drag-over'));
      targetCase.addEventListener('drop', (event) => {
        event.preventDefault();
        targetCase.classList.remove('drag-over');
        if (!draggedElement || (targetCase.querySelector('.pot') && targetCase.querySelector('.pot') !== draggedElement)) return;
        cleanupPlaceholders();
        if (movePotToElement(draggedElement, targetCase)) persistState();
      });
    });

    source?.addEventListener('dragover', (event) => event.preventDefault());
    source?.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!draggedElement) return;
      cleanupPlaceholders();
      if (movePotToElement(draggedElement, source)) persistState();
    });

    tri?.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      if (!draggedElement || (draggedPlaceholder && event.target === draggedPlaceholder)) return;

      if (!insertPlaceholder) {
        insertPlaceholder = document.createElement('div');
        insertPlaceholder.className = 'insert-placeholder';
        insertPlaceholder.style.width = '55px';
        insertPlaceholder.style.height = '70px';
        insertPlaceholder.style.display = 'inline-block';
        insertPlaceholder.style.backgroundColor = '#e8f5e9';
        insertPlaceholder.style.border = '2px dashed #4caf50';
        insertPlaceholder.style.borderRadius = '6px';
        insertPlaceholder.style.flexShrink = '0';
      }

      const after = getDragAfterElement(tri, event.clientX);
      if (!after) tri.appendChild(insertPlaceholder);
      else tri.insertBefore(insertPlaceholder, after);
    });

    tri?.addEventListener('drop', (event) => {
      event.preventDefault();
      if (!draggedElement) return;
      const before = insertPlaceholder && insertPlaceholder.parentElement === tri ? insertPlaceholder : null;
      if (draggedPlaceholder) {
        draggedPlaceholder.remove();
        draggedPlaceholder = null;
      }
      if (movePotToElement(draggedElement, tri, before)) {
        if (insertPlaceholder) insertPlaceholder.remove();
        insertPlaceholder = null;
        persistState();
      }
    });

    tri?.addEventListener('dragleave', (event) => {
      if (event.target === tri && !tri.contains(event.relatedTarget)) {
        if (insertPlaceholder?.parentElement === tri) insertPlaceholder.remove();
        insertPlaceholder = null;
      }
    });
  }

  function restoreValidatedUi() {
    if (!hasStoredResult()) return false;
    computeScore(true);
    setNextMode();
    return true;
  }

  function install() {
    createPots();
    const restored = restoreState();
    installDragAndDrop();

    if (restored.validated || hasStoredResult()) restoreValidatedUi();
    else setVerifyMode();

    if (!restored.restored) persistState(false);
  }

  window.sebStock = Object.freeze({
    pots,
    totalEvaluated:TOTAL_EVALUATED,
    getCorrectPosition,
    positionsForPotId:(id) => positionsForPot(potElement(id)),
    capturePositions,
    persistState,
    restoreState,
    restorePositions,
    computeScore,
    verifyPlacements,
    placePot,
    goNext,
    resultFromStorage
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
