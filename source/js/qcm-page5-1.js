(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const STATE_KEY = 'seb_evalpro_qcm_page5_1_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const TOTAL = 3;
  const ALLOWED = Object.freeze(['2', '3', '5']);

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function input(index) {
    return document.getElementById('reponse5_1_' + index);
  }

  function currentValues() {
    const values = {};
    for (let i = 1; i <= TOTAL; i += 1) {
      values[i] = String(input(i)?.value || '').trim();
    }
    return values;
  }

  function anyEntry(values) {
    const data = values || currentValues();
    return Object.values(data).some((value) => String(value || '').trim() !== '');
  }

  function evaluate(values) {
    const data = values || currentValues();
    const used = new Set();
    const details = {};
    let score = 0;

    for (let i = 1; i <= TOTAL; i += 1) {
      const response = String(data[i] == null ? '' : data[i]).trim();
      const allowed = ALLOWED.includes(response);
      const duplicate = allowed && used.has(response);
      const correct = allowed && !duplicate;

      if (correct) {
        score += 1;
        used.add(response);
      }

      details[i] = {
        reponse:response,
        allowed,
        duplicate,
        correct
      };
    }

    return { score, total:TOTAL, details };
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
    if (!values || typeof values !== 'object') return false;
    for (let i = 1; i <= TOTAL; i += 1) {
      const field = input(i);
      if (field && values[i] !== undefined && values[i] !== null) field.value = String(values[i]);
    }
    return true;
  }

  function valuesFromHistoricalResponses() {
    const responses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const values = {};
    let found = false;
    for (let i = 1; i <= TOTAL; i += 1) {
      const key = 'page5_1_q' + i;
      if (responses[key] !== undefined) {
        values[i] = String(responses[key] ?? '');
        found = true;
      }
    }
    return found ? values : null;
  }

  function valuesFromLegacyDraft() {
    const drafts = parseObject(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    const draft = drafts.page5_1;
    if (!draft || !Array.isArray(draft.values)) return null;

    const values = {};
    let found = false;
    draft.values.forEach((saved) => {
      const match = String(saved?.id || '').match(/^reponse5_1_(\d+)$/);
      if (!match) return;
      const index = Number(match[1]);
      if (index < 1 || index > TOTAL) return;
      values[index] = String(saved?.value == null ? '' : saved.value);
      found = true;
    });
    return found ? values : null;
  }

  function restoreState() {
    let canonical = null;
    try { canonical = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (_) {}
    if (canonical && canonical.values) {
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

    for (let i = 1; i <= TOTAL; i += 1) {
      storedResponses['page5_1_q' + i] = result.details[i].reponse;
      storedScores['page5_1_q' + i] = result.details[i].correct ? 1 : 0;
    }

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
    window.sebParcours.goNext('qcm-5_1');
    return result;
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    restoreState();

    for (let i = 1; i <= TOTAL; i += 1) {
      input(i)?.addEventListener('input', persistDraft);
      input(i)?.addEventListener('change', persistDraft);
    }

    document.getElementById('page5_1Pass')?.addEventListener('click', goNext);
    document.getElementById('page5_1Next')?.addEventListener('click', goNext);

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmPage5_1 = Object.freeze({
    allowed:ALLOWED,
    total:TOTAL,
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
