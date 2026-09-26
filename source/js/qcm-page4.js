(function () {
  'use strict';

  const RESPONSE_STORAGE = 'reponses_data';
  const SCORE_STORAGE = 'scores_data';
  const STATE_KEY = 'seb_evalpro_qcm_page4_state';
  const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';
  const PAGE_KEY = 'page4';
  const TOTAL_FRACTIONS = 3;
  const CLOUD_FRACTIONS = new Set(['2/8', '3/12']);

  let resizeTimer = null;

  function parseObject(value) {
    try {
      const parsed = JSON.parse(value || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function wrappers() {
    return Array.from(document.querySelectorAll('#page4 .items-wrapper[data-fraction]'));
  }

  function fractionInfo(wrapper) {
    const fraction = String(wrapper?.dataset?.fraction || '').trim();
    const parts = fraction.split('/');
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]) || 1;
    const total = wrapper ? wrapper.querySelectorAll('.item').length : 0;
    const expected = Math.round((numerator / denominator) * total);
    return { fraction, numerator, denominator, total, expected };
  }

  function isCloud(wrapper) {
    const fraction = String(wrapper?.dataset?.fraction || '').trim();
    return !!wrapper && (wrapper.dataset.cloud === 'true' || CLOUD_FRACTIONS.has(fraction));
  }

  function itemSize() {
    const root = getComputedStyle(document.documentElement);
    return parseInt(root.getPropertyValue('--item-size'), 10) || 80;
  }

  function cloudMetrics(wrapper) {
    const size = itemSize();
    const width = wrapper.clientWidth || wrapper.offsetWidth || 900;
    const height = wrapper.clientHeight || parseInt(wrapper.style.height, 10) || 300;
    return {
      size,
      width,
      height,
      maxX:Math.max(0, width - size),
      maxY:Math.max(0, height - size)
    };
  }

  function prepareCloud(wrapper) {
    if (!isCloud(wrapper)) return;
    wrapper.style.position = 'relative';
    wrapper.style.display = 'block';
    wrapper.style.width = '100%';
    wrapper.style.maxWidth = wrapper.style.maxWidth || '900px';
    if (!wrapper.style.height) wrapper.style.height = '300px';
    wrapper.style.marginTop = wrapper.style.marginTop || '12px';
    wrapper.style.border = wrapper.style.border || '1px dashed #bbb';
    wrapper.querySelectorAll('.item').forEach((item) => {
      item.style.position = 'absolute';
    });
  }

  function nonOverlappingPosition(placed, metrics, margin) {
    let x = 0;
    let y = 0;
    let overlap = true;
    let attempts = 0;

    while (overlap && attempts < 400) {
      x = Math.random() * metrics.maxX;
      y = Math.random() * metrics.maxY;
      attempts += 1;
      overlap = placed.some((pos) =>
        Math.abs(pos.x - x) < metrics.size + margin &&
        Math.abs(pos.y - y) < metrics.size + margin
      );
    }

    if (overlap) {
      const step = metrics.size + margin;
      outer:
      for (let gy = 0; gy <= metrics.maxY; gy += step) {
        for (let gx = 0; gx <= metrics.maxX; gx += step) {
          const blocked = placed.some((pos) =>
            Math.abs(pos.x - gx) < metrics.size + margin &&
            Math.abs(pos.y - gy) < metrics.size + margin
          );
          if (!blocked) {
            x = gx;
            y = gy;
            overlap = false;
            break outer;
          }
        }
      }
    }

    return { x, y };
  }

  function randomizeCloud(wrapper) {
    if (!isCloud(wrapper)) return [];
    prepareCloud(wrapper);
    const metrics = cloudMetrics(wrapper);
    const margin = 6;
    const placed = [];

    Array.from(wrapper.querySelectorAll('.item')).forEach((item) => {
      const pos = nonOverlappingPosition(placed, metrics, margin);
      placed.push(pos);
      item.style.left = pos.x + 'px';
      item.style.top = pos.y + 'px';
    });

    return placed;
  }

  function collectSelections() {
    const selections = {};
    wrappers().forEach((wrapper) => {
      const fraction = String(wrapper.dataset.fraction || '').trim();
      selections[fraction] = Array.from(wrapper.querySelectorAll('.item')).map((item) =>
        item.classList.contains('selected')
      );
    });
    return selections;
  }

  function collectCloudPositions() {
    const positions = {};
    wrappers().forEach((wrapper) => {
      if (!isCloud(wrapper)) return;
      const fraction = String(wrapper.dataset.fraction || '').trim();
      const metrics = cloudMetrics(wrapper);
      positions[fraction] = Array.from(wrapper.querySelectorAll('.item')).map((item) => {
        const x = parseFloat(item.style.left) || 0;
        const y = parseFloat(item.style.top) || 0;
        return {
          x:metrics.maxX > 0 ? x / metrics.maxX : 0,
          y:metrics.maxY > 0 ? y / metrics.maxY : 0
        };
      });
    });
    return positions;
  }

  function applySelections(selections) {
    if (!selections || typeof selections !== 'object') return false;
    wrappers().forEach((wrapper) => {
      const fraction = String(wrapper.dataset.fraction || '').trim();
      const saved = selections[fraction];
      if (!Array.isArray(saved)) return;
      Array.from(wrapper.querySelectorAll('.item')).forEach((item, index) => {
        const selected = !!saved[index];
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    });
    return true;
  }

  function applyCloudPositions(positions) {
    if (!positions || typeof positions !== 'object') return false;
    let restored = false;
    wrappers().forEach((wrapper) => {
      if (!isCloud(wrapper)) return;
      const fraction = String(wrapper.dataset.fraction || '').trim();
      const saved = positions[fraction];
      if (!Array.isArray(saved) || !saved.length) return;
      prepareCloud(wrapper);
      const metrics = cloudMetrics(wrapper);
      Array.from(wrapper.querySelectorAll('.item')).forEach((item, index) => {
        const pos = saved[index];
        if (!pos || !Number.isFinite(Number(pos.x)) || !Number.isFinite(Number(pos.y))) return;
        const nx = Math.max(0, Math.min(1, Number(pos.x)));
        const ny = Math.max(0, Math.min(1, Number(pos.y)));
        item.style.left = (nx * metrics.maxX) + 'px';
        item.style.top = (ny * metrics.maxY) + 'px';
        restored = true;
      });
    });
    return restored;
  }

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function persistState(saveCandidate) {
    const state = {
      selections:collectSelections(),
      positions:collectCloudPositions(),
      savedAt:Date.now()
    };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    if (saveCandidate !== false) persistCandidate();
    return state;
  }

  function legacySelections() {
    const drafts = parseObject(sessionStorage.getItem(LEGACY_DRAFT_KEY));
    const draft = drafts.page4;
    if (!draft || !Array.isArray(draft.items)) return null;

    const selections = {};
    let offset = 0;
    wrappers().forEach((wrapper) => {
      const fraction = String(wrapper.dataset.fraction || '').trim();
      const count = wrapper.querySelectorAll('.item').length;
      selections[fraction] = draft.items.slice(offset, offset + count).map(Boolean);
      offset += count;
    });
    return selections;
  }

  function restoreState() {
    wrappers().forEach(prepareCloud);

    let canonical = null;
    try { canonical = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (_) {}

    if (canonical && canonical.selections) {
      applySelections(canonical.selections);
      const hasPositions = applyCloudPositions(canonical.positions);
      if (!hasPositions) wrappers().filter(isCloud).forEach(randomizeCloud);
      persistState(false);
      return { source:'canonical', restored:true };
    }

    const legacy = legacySelections();
    if (legacy) {
      applySelections(legacy);
      wrappers().filter(isCloud).forEach(randomizeCloud);
      persistState();
      return { source:'legacy-draft', restored:true };
    }

    wrappers().filter(isCloud).forEach(randomizeCloud);
    persistState(false);
    return { source:'empty', restored:false };
  }

  function evaluate() {
    let score = 0;
    const details = {};
    wrappers().forEach((wrapper) => {
      const info = fractionInfo(wrapper);
      const selected = wrapper.querySelectorAll('.item.selected').length;
      const correct = selected === info.expected;
      if (correct) score += 1;
      details[info.fraction] = {
        selected,
        total:info.total,
        expected:info.expected,
        correct
      };
    });
    return { score, total:wrappers().length, details };
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
    const result = evaluate();
    const storedResponses = parseObject(sessionStorage.getItem(RESPONSE_STORAGE));
    const storedScores = parseObject(sessionStorage.getItem(SCORE_STORAGE));

    storedResponses[PAGE_KEY] = result.score + '/' + result.total;
    storedScores[PAGE_KEY] = result.score;

    if (mode === 'pass') {
      storedResponses['4'] = 'Mauvaise';
      storedScores['4'] = 0;
    } else if (mode === 'next') {
      storedResponses['4'] = 'Bonne';
      storedScores['4'] = 1;
    }

    sessionStorage.setItem(RESPONSE_STORAGE, JSON.stringify(storedResponses));
    sessionStorage.setItem(SCORE_STORAGE, JSON.stringify(storedScores));
    persistState(false);

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
    window.sebParcours.goNext('qcm-4');
    return result;
  }

  function toggleItem(item) {
    const selected = item.classList.toggle('selected');
    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    persistState();
    return selected;
  }

  function attachToggle(item) {
    if (item.dataset.sebFractionToggle === '1') return;
    item.dataset.sebFractionToggle = '1';

    item.addEventListener('click', function () {
      toggleItem(item);
    });

    item.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleItem(item);
    });
  }

  function relayoutClouds() {
    wrappers().filter(isCloud).forEach(randomizeCloud);
    persistState();
  }

  function install() {
    syncStoredMapsIntoLegacyGlobals();
    wrappers().forEach((wrapper) => {
      wrapper.querySelectorAll('.item').forEach(attachToggle);
    });

    restoreState();

    document.getElementById('page4Pass')?.addEventListener('click', function () { goNext('pass'); });
    document.getElementById('page4Next')?.addEventListener('click', function () { goNext('next'); });

    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(relayoutClouds, 120);
    });

    setTimeout(function () {
      syncStoredMapsIntoLegacyGlobals();
      restoreState();
    }, 0);
  }

  window.sebQcmPage4 = Object.freeze({
    total:TOTAL_FRACTIONS,
    fractionInfo,
    evaluate,
    collectSelections,
    collectCloudPositions,
    persistState,
    restoreState,
    randomizeCloud,
    toggleItem,
    save,
    goNext
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
