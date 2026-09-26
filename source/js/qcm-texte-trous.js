(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const STATE_KEY = 'seb_evalpro_qcm_texte_trous_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const PAGE_KEY = 'pageTexteTrous';
  const TOTAL = 15;

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function inputs() {
    return Array.from(document.querySelectorAll('#pageTexteTrous input[type="text"][data-answer]'));
  }

  function normalizeAnswer(value) {
    return String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('fr-FR');
  }

  function currentValues() {
    return inputs().map((input) => String(input.value || ''));
  }

  function anyEntry(values) {
    const list = Array.isArray(values) ? values : currentValues();
    return list.some((value) => String(value || '').trim() !== '');
  }

  function evaluate(values) {
    const list = Array.isArray(values) ? values : currentValues();
    let score = 0;
    const responses = inputs().map((input, index) => {
      const user = normalizeAnswer(list[index]);
      const correct = normalizeAnswer(input.dataset.answer || '');
      if (user === correct) score += 1;
      return { user, correct };
    });
    return { score, total:TOTAL, responses };
  }

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function persistDraft() {
    const values = currentValues();
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ values, savedAt:Date.now() }));
    persistCandidate();
    return values;
  }

  function applyValues(values) {
    if (!Array.isArray(values)) return false;
    inputs().forEach((input, index) => {
      if (values[index] !== undefined && values[index] !== null) input.value = String(values[index]);
    });
    return true;
  }

  function valuesFromHistoricalResponses() {
    const responses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const stored = responses[PAGE_KEY];
    if (!Array.isArray(stored) || !stored.length) return null;
    return stored.slice(0, TOTAL).map((item) => String(item?.user ?? ''));
  }

  function valuesFromLegacyDraft() {
    const drafts = parseObject(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    const draft = drafts.pageTexteTrous;
    if (!draft || !Array.isArray(draft.values)) return null;
    const values = [];
    draft.values.filter((saved) => String(saved?.type || '') === 'text').slice(0, TOTAL).forEach((saved, index) => {
      values[index] = String(saved?.value ?? '');
    });
    return values.length ? values : null;
  }

  function restoreState() {
    let canonical = null;
    try { canonical = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (_) {}
    if (canonical && Array.isArray(canonical.values)) {
      applyValues(canonical.values);
      return { source:'canonical', restored:true };
    }

    const historical = valuesFromHistoricalResponses();
    if (historical) {
      applyValues(historical);
      persistDraft();
      return { source:'historical', restored:true };
    }

    const legacy = valuesFromLegacyDraft();
    if (legacy) {
      applyValues(legacy);
      persistDraft();
      return { source:'legacy-draft', restored:true };
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
    const values = currentValues();
    const result = evaluate(values);
    const storedResponses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const storedScores = parseObject(sessionStorage.getItem(SCORE_STORAGE));

    storedResponses[PAGE_KEY] = result.responses;
    storedScores[PAGE_KEY] = result.score;

    sessionStorage.setItem(RESPONSE_STORAGE, JSON.stringify(storedResponses));
    sessionStorage.setItem(SCORE_STORAGE, JSON.stringify(storedScores));
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ values, savedAt:Date.now() }));

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
    window.sebParcours.goNext('qcm-texte-trous');
    return result;
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    restoreState();
    inputs().forEach((input) => {
      input.addEventListener('input', persistDraft);
      input.addEventListener('change', persistDraft);
    });
    document.getElementById('texteTrousPass')?.addEventListener('click', goNext);
    document.getElementById('texteTrousNext')?.addEventListener('click', goNext);

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmTexteTrous = Object.freeze({
    total:TOTAL,
    normalizeAnswer,
    currentValues,
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
