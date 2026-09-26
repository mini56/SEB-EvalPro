(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const STATE_KEY = 'seb_evalpro_qcm_page6_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const TOTAL = 10;
  const OPERATION_START = 11;
  const OPERATION_END = 20;

  const answers = Object.freeze({
    1:'2300', 2:'7500', 3:'2.5', 4:'8400', 5:'3200',
    6:'450', 7:'750', 8:'5.6', 9:'1250', 10:'4'
  });

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
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

  function answerInput(index) {
    return document.getElementById('reponse6_' + index);
  }

  function unitInput(index) {
    return document.getElementById('unite6_' + index);
  }

  function operationInput(index) {
    return document.getElementById('reponse6_' + index);
  }

  function currentValues() {
    const values = { answers:{}, units:{}, operations:{} };
    for (let i = 1; i <= TOTAL; i += 1) {
      values.answers[i] = String(answerInput(i)?.value || '').trim();
      values.units[i] = String(unitInput(i)?.value || '').trim();
    }
    for (let i = OPERATION_START; i <= OPERATION_END; i += 1) {
      values.operations[i] = String(operationInput(i)?.value || '').trim();
    }
    return values;
  }

  function anyEntry(values) {
    const data = values || currentValues();
    return [
      ...Object.values(data.answers || {}),
      ...Object.values(data.units || {}),
      ...Object.values(data.operations || {})
    ].some((value) => String(value || '').trim() !== '');
  }

  function evaluate(values) {
    const data = values || currentValues();
    const details = {};
    let score = 0;

    for (let i = 1; i <= TOTAL; i += 1) {
      const response = String(data.answers?.[i] == null ? '' : data.answers[i]).trim();
      const correct = sameNumeric(response, answers[i]);
      if (correct) score += 1;
      details[i] = {
        reponse:response,
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
    const values = currentValues();
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ values, savedAt:Date.now() }));
    persistCandidate();
    return values;
  }

  function applyValues(values) {
    if (!values || typeof values !== 'object') return false;
    const answerValues = values.answers || {};
    const unitValues = values.units || {};
    const operationValues = values.operations || {};

    for (let i = 1; i <= TOTAL; i += 1) {
      const answer = answerInput(i);
      const unit = unitInput(i);
      if (answer && answerValues[i] !== undefined && answerValues[i] !== null) {
        answer.value = String(answerValues[i]);
      }
      if (unit && unitValues[i] !== undefined && unitValues[i] !== null) {
        unit.value = String(unitValues[i]);
      }
    }

    for (let i = OPERATION_START; i <= OPERATION_END; i += 1) {
      const operation = operationInput(i);
      if (operation && operationValues[i] !== undefined && operationValues[i] !== null) {
        operation.value = String(operationValues[i]);
      }
    }
    return true;
  }

  function valuesFromHistoricalResponses() {
    const responses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const values = { answers:{}, units:{}, operations:{} };
    let found = false;

    for (let i = 1; i <= TOTAL; i += 1) {
      const answerKey = 'page6_q' + i;
      const unitKey = 'page6_unite' + i;
      if (responses[answerKey] !== undefined) {
        values.answers[i] = String(responses[answerKey] ?? '');
        found = true;
      }
      if (responses[unitKey] !== undefined) {
        values.units[i] = String(responses[unitKey] ?? '');
        found = true;
      }
    }

    for (let i = OPERATION_START; i <= OPERATION_END; i += 1) {
      const key = 'page6_q' + i;
      if (responses[key] !== undefined) {
        values.operations[i] = String(responses[key] ?? '');
        found = true;
      }
    }

    return found ? values : null;
  }

  function valuesFromLegacyDraft() {
    const drafts = parseObject(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    const draft = drafts.page6;
    if (!draft || !Array.isArray(draft.values)) return null;

    const values = { answers:{}, units:{}, operations:{} };
    let found = false;

    draft.values.forEach((saved) => {
      const id = String(saved?.id || '');
      let match = id.match(/^unite6_(\d+)$/);
      if (match) {
        const index = Number(match[1]);
        if (index >= 1 && index <= TOTAL) {
          values.units[index] = String(saved?.value == null ? '' : saved.value);
          found = true;
        }
        return;
      }

      match = id.match(/^reponse6_(\d+)$/);
      if (!match) return;
      const index = Number(match[1]);
      if (index >= 1 && index <= TOTAL) {
        values.answers[index] = String(saved?.value == null ? '' : saved.value);
        found = true;
      } else if (index >= OPERATION_START && index <= OPERATION_END) {
        values.operations[index] = String(saved?.value == null ? '' : saved.value);
        found = true;
      }
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
      storedResponses['page6_q' + i] = result.details[i].reponse;
      storedScores['page6_q' + i] = result.details[i].correct ? 1 : 0;
      storedResponses['page6_unite' + i] = String(values.units[i] || '').trim();
      storedScores['page6_unite' + i] = 0;
    }

    for (let i = OPERATION_START; i <= OPERATION_END; i += 1) {
      storedResponses['page6_q' + i] = String(values.operations[i] || '').trim();
      storedScores['page6_q' + i] = 0;
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
    window.sebParcours.goNext('qcm-6');
    return result;
  }

  function sanitizeAnswer(field) {
    if (!field) return;
    const cleaned = String(field.value || '').replace(/[^0-9.,]/g, '');
    if (field.value !== cleaned) field.value = cleaned;
  }

  function allowNumericKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (/^\d$/.test(key)) return;
    if (key === '.' || key === ',') return;
    if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(key)) return;
    event.preventDefault();
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    restoreState();

    for (let i = 1; i <= TOTAL; i += 1) {
      const answer = answerInput(i);
      const unit = unitInput(i);

      answer?.addEventListener('keydown', allowNumericKey);
      answer?.addEventListener('input', function () {
        sanitizeAnswer(answer);
        persistDraft();
      });
      answer?.addEventListener('change', persistDraft);

      unit?.addEventListener('input', persistDraft);
      unit?.addEventListener('change', persistDraft);
    }

    for (let i = OPERATION_START; i <= OPERATION_END; i += 1) {
      operationInput(i)?.addEventListener('input', persistDraft);
      operationInput(i)?.addEventListener('change', persistDraft);
    }

    document.getElementById('page6Pass')?.addEventListener('click', goNext);
    document.getElementById('page6Next')?.addEventListener('click', goNext);

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmPage6 = Object.freeze({
    answers,
    total:TOTAL,
    operationRange:Object.freeze([OPERATION_START, OPERATION_END]),
    normalizeNumeric,
    sameNumeric,
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
