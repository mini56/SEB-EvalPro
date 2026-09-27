(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const STATE_KEY = 'seb_evalpro_qcm_page2_1_state';
  const TOTAL = 5;
  const START = 6;
  const END = 10;
  const answers = Object.freeze({ 6:'10', 7:'75', 8:'12', 9:'24', 10:'165' });

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function responseInput(index) {
    return document.getElementById('reponse2_1_' + index);
  }

  function unitInput(index) {
    return document.getElementById('unite2_1_' + index);
  }

  function normalizeNumeric(value) {
    const raw = String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function sameNumeric(left, right) {
    const a = normalizeNumeric(left);
    const b = normalizeNumeric(right);
    return a !== null && b !== null && Math.abs(a - b) < 1e-9;
  }

  function currentState() {
    const values = {};
    const units = {};
    for (let i = START; i <= END; i += 1) {
      values[i] = String(responseInput(i)?.value || '').trim();
      units[i] = String(unitInput(i)?.value || '').trim();
    }
    return { values, units };
  }

  function anyEntry(state) {
    const data = state || currentState();
    return Object.values(data.values || {}).some((value) => String(value || '').trim() !== '') ||
      Object.values(data.units || {}).some((value) => String(value || '').trim() !== '');
  }

  function evaluate(state) {
    const data = state || currentState();
    const details = {};
    let score = 0;
    for (let i = START; i <= END; i += 1) {
      const response = String(data.values?.[i] || '').trim();
      const correct = sameNumeric(response, answers[i]);
      if (correct) score += 1;
      details[i] = {
        reponse:response,
        unite:String(data.units?.[i] || '').trim(),
        attendu:answers[i],
        correct
      };
    }
    return { score, total:TOTAL, details };
  }

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function persistDraft() {
    const state = currentState();
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      values:state.values,
      units:state.units,
      savedAt:Date.now()
    }));
    persistCandidate();
    return state;
  }

  function applyState(state) {
    if (!state) return false;
    for (let i = START; i <= END; i += 1) {
      const response = responseInput(i);
      const unit = unitInput(i);
      if (response && state.values && state.values[i] !== undefined) response.value = String(state.values[i]);
      if (unit && state.units && state.units[i] !== undefined) unit.value = String(state.units[i]);
    }
    return true;
  }

  function historicalState() {
    const responses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const values = {};
    const units = {};
    let found = false;
    for (let i = START; i <= END; i += 1) {
      const answerKey = 'page2_1_q' + i;
      const unitKey = 'page2_1_unite' + i;
      if (responses[answerKey] !== undefined) {
        values[i] = String(responses[answerKey] ?? '');
        found = true;
      }
      if (responses[unitKey] !== undefined) {
        units[i] = String(responses[unitKey] ?? '');
        found = true;
      }
    }
    return found ? { values, units } : null;
  }

  function restoreState() {
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (_) {}
    if (state && state.values) {
      applyState(state);
      return { source:'canonical', restored:true };
    }

    const historical = historicalState();
    if (historical) {
      applyState(historical);
      persistDraft();
      return { source:'historical', restored:true };
    }
    return { source:'empty', restored:false };
  }

  function syncStoredMapsIntoLegacyGlobals() {
    const storedResponses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const storedScores = parseObject(sessionStorage.getItem(SCORE_STORAGE));
    try {
      if (typeof reponses === 'object' && reponses) Object.assign(reponses, storedResponses);
      if (typeof scores === 'object' && scores) Object.assign(scores, storedScores);
    } catch (_) {}
  }

  function save() {
    const state = currentState();
    const result = evaluate(state);
    const storedResponses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const storedScores = parseObject(sessionStorage.getItem(SCORE_STORAGE));

    for (let i = START; i <= END; i += 1) {
      storedResponses['page2_1_q' + i] = result.details[i].reponse;
      storedScores['page2_1_q' + i] = result.details[i].correct ? 1 : 0;
      storedResponses['page2_1_unite' + i] = result.details[i].unite;
      storedScores['page2_1_unite' + i] = 0;
    }

    sessionStorage.setItem(RESPONSE_STORAGE, JSON.stringify(storedResponses));
    sessionStorage.setItem(SCORE_STORAGE, JSON.stringify(storedScores));
    sessionStorage.setItem(STATE_KEY, JSON.stringify({
      values:state.values,
      units:state.units,
      savedAt:Date.now()
    }));

    try {
      if (typeof reponses === 'object' && reponses) Object.assign(reponses, storedResponses);
      if (typeof scores === 'object' && scores) Object.assign(scores, storedScores);
    } catch (_) {}

    persistCandidate();
    return result;
  }

  function goNext() {
    const result = save();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('qcm-2_1');
    return result;
  }

  function installNumericProtection() {
    for (let i = START; i <= END; i += 1) {
      const input = responseInput(i);
      if (!input) continue;

      input.addEventListener('keydown', function (event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const allowed = new Set([
          'Backspace','Delete','Tab','Escape','Enter',
          'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
          'Home','End',',','.'
        ]);
        if (/^\d$/.test(event.key) || allowed.has(event.key)) return;
        event.preventDefault();
      });

      input.addEventListener('input', function () {
        const cleaned = this.value.replace(/[^0-9.,]/g, '');
        if (this.value !== cleaned) this.value = cleaned;
      });
    }
  }

  function onDraftChange() {
    persistDraft();
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    restoreState();
    installNumericProtection();

    for (let i = START; i <= END; i += 1) {
      responseInput(i)?.addEventListener('input', onDraftChange);
      responseInput(i)?.addEventListener('change', onDraftChange);
      unitInput(i)?.addEventListener('input', onDraftChange);
      unitInput(i)?.addEventListener('change', onDraftChange);
    }

    document.getElementById('page2_1Pass')?.addEventListener('click', goNext);
    document.getElementById('page2_1Next')?.addEventListener('click', goNext);

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmPage2_1 = Object.freeze({
    answers,
    total:TOTAL,
    normalizeNumeric,
    sameNumeric,
    currentState,
    anyEntry,
    evaluate,
    persistDraft,
    restoreState,
    save,
    goNext
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
