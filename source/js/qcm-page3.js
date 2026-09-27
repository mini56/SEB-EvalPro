(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const DEDICATED_KEY = 'page3_resultats';
  const STATE_KEY = 'seb_evalpro_qcm_page3_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const TOTAL = 14;

  const answers = Object.freeze({
    1:'9h15', 2:'8h50', 3:'9h05', 4:'9h20', 5:'8h45', 6:'5h15',
    7:'9h45', 8:'9h15', 9:'9h30', 10:'9h55', 11:'9h25', 12:'2h35',
    13:'0h31', 14:'1h03'
  });

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function normalizeText(value) {
    let text = String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLocaleLowerCase('fr-FR');
    if (!text) return '';
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    return text
      .replace(/heures?/g, 'h')
      .replace(/heurs?/g, 'h')
      .replace(/hrs?/g, 'h')
      .replace(/minutes?/g, 'm')
      .replace(/mins?/g, 'm')
      .replace(/mn/g, 'm')
      .replace(/\bet\b/g, ' ')
      .replace(/[.;]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseTimeToMinutes(value) {
    const text = normalizeText(value);
    if (!text) return null;

    let match = text.match(/^(\d+)\s*m$/);
    if (match) {
      const minutes = Number(match[1]);
      return Number.isSafeInteger(minutes) && minutes >= 0 ? minutes : null;
    }

    match = text.match(/^(\d+)\s*h$/);
    if (match) {
      const hours = Number(match[1]);
      return Number.isSafeInteger(hours) && hours >= 0 ? hours * 60 : null;
    }

    match = text.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})\s*m?$/);
    if (!match) match = text.match(/^(\d+)\s+(\d{1,2})$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isSafeInteger(hours) || hours < 0) return null;
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function sameTime(left, right) {
    const a = parseTimeToMinutes(left);
    const b = parseTimeToMinutes(right);
    return a !== null && b !== null && a === b;
  }

  function input(index) {
    return document.getElementById('reponse3_' + index);
  }

  function currentValues() {
    const values = {};
    for (let i = 1; i <= TOTAL; i += 1) values[i] = String(input(i)?.value || '').trim();
    return values;
  }

  function evaluate(values) {
    const user = values || currentValues();
    const details = {};
    let score = 0;
    for (let i = 1; i <= TOTAL; i += 1) {
      const response = String(user[i] == null ? '' : user[i]).trim();
      const correct = sameTime(response, answers[i]);
      if (correct) score += 1;
      details[i] = {
        reponse:response,
        attendu:answers[i],
        minutes:parseTimeToMinutes(response),
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
    if (!values) return false;
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
      const key = 'page3_q' + i;
      if (responses[key] !== undefined) {
        values[i] = String(responses[key] ?? '');
        found = true;
      }
    }
    return found ? values : null;
  }

  function valuesFromDedicated() {
    try {
      const dedicated = JSON.parse(sessionStorage.getItem(DEDICATED_KEY) || 'null');
      if (!dedicated || !dedicated.reponses) return null;
      const values = {};
      let found = false;
      for (let i = 1; i <= TOTAL; i += 1) {
        const key = 'page3_q' + i;
        if (dedicated.reponses[key] !== undefined) {
          values[i] = String(dedicated.reponses[key] ?? '');
          found = true;
        }
      }
      return found ? values : null;
    } catch (_) {
      return null;
    }
  }

  function valuesFromLegacyDraft() {
    const drafts = parseObject(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    const draft = drafts.page3;
    if (!draft || !Array.isArray(draft.values)) return null;
    const values = {};
    let found = false;
    draft.values.forEach((saved) => {
      const match = String(saved?.id || '').match(/^reponse3_(\d+)$/);
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

    const dedicated = valuesFromDedicated();
    if (dedicated) {
      applyValues(dedicated);
      persistDraft();
      return { source:'dedicated', restored:true };
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

  function save(mode) {
    const values = currentValues();
    const result = evaluate(values);
    const storedResponses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const storedScores = parseObject(sessionStorage.getItem(SCORE_STORAGE));
    const dedicatedResponses = {};
    const dedicatedScores = {};

    for (let i = 1; i <= TOTAL; i += 1) {
      const key = 'page3_q' + i;
      storedResponses[key] = result.details[i].reponse;
      storedScores[key] = result.details[i].correct ? 1 : 0;
      dedicatedResponses[key] = storedResponses[key];
      dedicatedScores[key] = storedScores[key];
    }

    storedResponses.page3_avg_reception = storedResponses.page3_avg_reception || '';
    storedResponses.page3_avg_rangement = storedResponses.page3_avg_rangement || '';

    if (mode === 'pass') {
      storedResponses['3'] = 'Mauvaise réponse';
      storedScores['3'] = 0;
    } else if (mode === 'next') {
      storedResponses['3'] = 'Bonne réponse';
      storedScores['3'] = 1;
    }

    sessionStorage.setItem(RESPONSE_STORAGE, JSON.stringify(storedResponses));
    sessionStorage.setItem(SCORE_STORAGE, JSON.stringify(storedScores));
    sessionStorage.setItem(DEDICATED_KEY, JSON.stringify({
      reponses:dedicatedResponses,
      scores:dedicatedScores,
      savedAt:new Date().toISOString()
    }));
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ values, savedAt:Date.now() }));

    try {
      if (typeof reponses === 'object' && reponses) Object.assign(reponses, storedResponses);
      if (typeof scores === 'object' && scores) Object.assign(scores, storedScores);
    } catch (_) {}

    persistCandidate();
    return result;
  }

  function goNext(mode) {
    const result = save(mode);
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('qcm-3');
    return result;
  }

  function onDraftChange() {
    persistDraft();
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    restoreState();

    for (let i = 1; i <= TOTAL; i += 1) {
      input(i)?.addEventListener('input', onDraftChange);
      input(i)?.addEventListener('change', onDraftChange);
    }

    document.getElementById('page3Pass')?.addEventListener('click', function () { goNext('pass'); });
    document.getElementById('page3Next')?.addEventListener('click', function () { goNext('next'); });

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmPage3 = Object.freeze({
    answers,
    total:TOTAL,
    normalizeText,
    parseTimeToMinutes,
    sameTime,
    currentValues,
    evaluate,
    persistDraft,
    restoreState,
    save,
    goNext
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
