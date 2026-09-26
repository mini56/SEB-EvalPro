(function () {
  'use strict';

  const DATA_KEY = 'tri_cheville_data';
  const AUTO_KEY = 'autoEvaltri_resultats';
  const READY_KEY = 'seb_tri_navigation_ready';
  const LIVE_KEY = 'seb_evalpro_tri_live_chrono';
  const MIN_TRIS = 3;
  const MAX_TRIS = 5;

  let currentTri = 1;
  let awaitingError = null;
  let chronoSeconds = 0;
  let chronoInterval = null;
  let chronoStartedAt = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function safeJson(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function validErrorValue(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (text === '') return null;
    const value = Number(text);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function hasExplicitError(index) {
    const input = byId('e' + index);
    return !!input && validErrorValue(input.value) !== null;
  }

  function rowHasTime(index) {
    const m = byId('m' + index);
    const s = byId('s' + index);
    if (!m || !s) return false;
    return String(m.value || '').trim() !== '' || String(s.value || '').trim() !== '';
  }

  function rowSeconds(index) {
    const m = Number(byId('m' + index)?.value || 0);
    const s = Number(byId('s' + index)?.value || 0);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return 0;
    return Math.max(0, Math.floor(m)) * 60 + Math.max(0, Math.floor(s));
  }

  function completedTriIndexes() {
    const completed = [];
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      if (rowHasTime(i) && hasExplicitError(i)) completed.push(i);
    }
    return completed;
  }

  function hasPartialTri() {
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      if (rowHasTime(i) !== hasExplicitError(i)) return true;
    }
    return false;
  }

  function isRunning() {
    return chronoInterval !== null;
  }

  function updateChronoDisplay() {
    const min = byId('chrono-min');
    const sec = byId('chrono-sec');
    if (min) min.textContent = String(Math.floor(chronoSeconds / 60)).padStart(2, '0');
    if (sec) sec.textContent = String(chronoSeconds % 60).padStart(2, '0');
  }

  function persistLiveChrono() {
    sessionStorage.setItem(LIVE_KEY, String(Math.max(0, Math.floor(chronoSeconds))));
  }

  function tickChrono() {
    if (!chronoStartedAt) return;
    chronoSeconds = Math.max(0, Math.floor((Date.now() - chronoStartedAt) / 1000));
    persistLiveChrono();
    updateChronoDisplay();
  }

  function stopInterval() {
    if (chronoInterval !== null) clearInterval(chronoInterval);
    chronoInterval = null;
    chronoStartedAt = 0;
  }

  function startChrono() {
    if (isRunning() || currentTri > MAX_TRIS) return false;
    if (awaitingError !== null) {
      const errorInput = byId('e' + awaitingError);
      if (errorInput) errorInput.focus();
      return false;
    }

    chronoStartedAt = Date.now() - chronoSeconds * 1000;
    chronoInterval = setInterval(tickChrono, 250);
    tickChrono();
    updateControls();
    return true;
  }

  function stopChrono() {
    if (!isRunning() || currentTri > MAX_TRIS) return false;

    tickChrono();
    stopInterval();

    const minutes = Math.floor(chronoSeconds / 60);
    const secondes = chronoSeconds % 60;
    const m = byId('m' + currentTri);
    const s = byId('s' + currentTri);
    if (m) m.value = String(minutes);
    if (s) s.value = String(secondes);

    awaitingError = currentTri;
    persistLiveChrono();
    persistTriData();
    updateControls();

    const errorInput = byId('e' + currentTri);
    if (errorInput) {
      setTimeout(() => {
        errorInput.focus();
        try { errorInput.select(); } catch (_) {}
      }, 0);
    }
    return true;
  }

  function completedStats() {
    const indexes = completedTriIndexes();
    let totalSeconds = 0;
    let totalErreurs = 0;

    for (const index of indexes) {
      totalSeconds += rowSeconds(index);
      totalErreurs += validErrorValue(byId('e' + index)?.value) || 0;
    }

    const averageSeconds = indexes.length > 0 ? Math.round(totalSeconds / indexes.length) : 0;
    const moyenne = indexes.length > 0
      ? String(Math.floor(averageSeconds / 60)).padStart(2, '0') + ':' + String(averageSeconds % 60).padStart(2, '0')
      : '00:00';

    return { indexes, totalSeconds, totalErreurs, averageSeconds, moyenne };
  }

  function autoLabels() {
    return Array.from(document.querySelectorAll("#autoEvalForm input[type='checkbox']:checked"))
      .map((checkbox) => checkbox.labels && checkbox.labels[0] ? checkbox.labels[0].innerText : checkbox.value);
  }

  function readTriRows() {
    const rows = [];
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      const m = byId('m' + i);
      const s = byId('s' + i);
      const e = byId('e' + i);
      rows.push({
        minutes: m ? String(m.value == null ? '' : m.value).trim() : '',
        secondes: s ? String(s.value == null ? '' : s.value).trim() : '',
        erreurs: e ? String(e.value == null ? '' : e.value).trim() : ''
      });
    }
    return rows;
  }

  function persistTriData() {
    const stats = completedStats();
    const data = {
      tris: readTriRows(),
      moyenne: stats.moyenne,
      totalErreurs: String(stats.totalErreurs),
      auto: autoLabels(),
      commentaire: byId('autoComment')?.value || '',
      currentTri,
      awaitingError
    };

    sessionStorage.setItem(DATA_KEY, JSON.stringify(data));

    const resMS = byId('resMS');
    const resErr = byId('resErr');
    if (resMS) resMS.textContent = stats.indexes.length > 0 ? stats.moyenne : '—';
    if (resErr) resErr.textContent = stats.indexes.length > 0 ? String(stats.totalErreurs) : '—';

    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    return data;
  }

  function saveAutoEval() {
    const selections = Array.from(document.querySelectorAll('#autoEvalForm input[type="checkbox"]:checked'))
      .map((checkbox) => checkbox.value);
    const commentaire = (byId('autoComment')?.value || '').trim();
    const data = { selections, commentaire };
    sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));
    persistTriData();
    return data;
  }

  function autoEvalAnswered() {
    const form = byId('autoEvalForm');
    if (!form) return false;
    if (form.querySelector('input[type="checkbox"]:checked')) return true;
    return String(byId('autoComment')?.value || '').trim() !== '';
  }

  function minimumTrisDone() {
    return completedTriIndexes().length >= MIN_TRIS && !hasPartialTri();
  }

  function navigationReady() {
    return sessionStorage.getItem(READY_KEY) === '1'
      && minimumTrisDone()
      && !isRunning()
      && awaitingError === null;
  }

  function refreshNextButton() {
    const next = byId('seb-tri-next');
    if (!next) return;
    const ready = navigationReady();
    next.classList.toggle('seb-exercise-nav-locked', !ready);
    next.setAttribute('aria-hidden', ready ? 'false' : 'true');
    next.tabIndex = ready ? 0 : -1;
  }

  function canShowResults() {
    return minimumTrisDone() && !isRunning() && awaitingError === null;
  }

  function refreshResultsButton() {
    const button = byId('calc');
    if (!button) return;
    button.textContent = 'Voir les résultats';
    button.disabled = !canShowResults();
  }

  function showAutoEvaluation() {
    const consigne = byId('consigne');
    const autoEvalPart = byId('autoEvalPart');
    if (!autoEvalPart || autoEvalPart.classList.contains('visible')) return;

    if (consigne) {
      consigne.classList.add('fade-out');
      setTimeout(() => {
        consigne.style.display = 'none';
        autoEvalPart.style.display = 'block';
        // La visibilité fonctionnelle ne dépend jamais de requestAnimationFrame :
        // une fenêtre Electron masquée ou reprise après pause peut suspendre les frames.
        autoEvalPart.classList.add('visible');
      }, 300);
    } else {
      autoEvalPart.style.display = 'block';
      autoEvalPart.classList.add('visible');
    }
  }

  function showResults() {
    if (!canShowResults()) {
      window.alert('Renseignez au moins 3 tris complets avec le temps et le nombre d’erreurs de chacun (0 si aucune erreur) avant d’afficher les résultats.');
      return false;
    }

    persistTriData();
    const results = document.querySelector('#right .results-container');
    if (results) results.style.display = 'flex';
    showAutoEvaluation();
    refreshResultsButton();
    return true;
  }

  function updateControls() {
    const start = byId('startBtn');
    const stop = byId('stopBtn');

    if (start) {
      start.disabled = isRunning() || awaitingError !== null || currentTri > MAX_TRIS;
    }
    if (stop) {
      stop.disabled = !isRunning();
    }

    refreshResultsButton();
    refreshNextButton();
  }

  function finalizeError(index) {
    if (index < 1 || index > MAX_TRIS) return false;
    const errorInput = byId('e' + index);
    const value = validErrorValue(errorInput?.value);
    if (value === null) {
      if (index === awaitingError) updateControls();
      return false;
    }

    if (index !== awaitingError) {
      persistTriData();
      refreshResultsButton();
      refreshNextButton();
      return true;
    }

    currentTri = index + 1;
    awaitingError = null;
    chronoSeconds = 0;
    sessionStorage.setItem(LIVE_KEY, '0');
    updateChronoDisplay();
    persistTriData();
    updateControls();

    const start = byId('startBtn');
    if (start && currentTri <= MAX_TRIS) setTimeout(() => start.focus(), 0);
    return true;
  }

  function validateAutoEvaluation(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!minimumTrisDone()) {
      window.alert('Renseignez au moins 3 tris complets avec le temps et le nombre d’erreurs de chacun (0 si aucune erreur) avant de valider l’autoévaluation.');
      refreshNextButton();
      return false;
    }

    if (!autoEvalAnswered()) {
      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');
      refreshNextButton();
      return false;
    }

    saveAutoEval();
    sessionStorage.setItem(READY_KEY, '1');

    const button = byId('seb-tri-auto-validate');
    if (button) {
      button.disabled = true;
      button.textContent = 'Autoévaluation validée ✓';
    }

    refreshNextButton();
    const next = byId('seb-tri-next');
    if (next) setTimeout(() => next.focus(), 0);
    return true;
  }

  function navigateNext() {
    persistTriData();
    saveAutoEval();
    if (!navigationReady()) return false;
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('tri-de-cheville');
    return true;
  }

  function restoreAutoEvaluation() {
    const saved = safeJson(AUTO_KEY, null);
    if (!saved) return;
    const selected = new Set(Array.isArray(saved.selections) ? saved.selections : []);
    document.querySelectorAll('#autoEvalForm input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.value);
    });
    const comment = byId('autoComment');
    if (comment && !comment.value && typeof saved.commentaire === 'string') comment.value = saved.commentaire;
  }

  function derivePosition() {
    awaitingError = null;
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      if (rowHasTime(i) && !hasExplicitError(i)) {
        currentTri = i;
        awaitingError = i;
        chronoSeconds = rowSeconds(i);
        return;
      }
      if (!rowHasTime(i)) {
        currentTri = i;
        return;
      }
    }
    currentTri = MAX_TRIS + 1;
  }

  function restoreTri() {
    const data = safeJson(DATA_KEY, null);
    if (data && Array.isArray(data.tris)) {
      data.tris.slice(0, MAX_TRIS).forEach((tri, index) => {
        const i = index + 1;
        const m = byId('m' + i);
        const s = byId('s' + i);
        const e = byId('e' + i);
        if (m && tri && tri.minutes !== undefined && tri.minutes !== null) m.value = String(tri.minutes);
        if (s && tri && tri.secondes !== undefined && tri.secondes !== null) s.value = String(tri.secondes);
        if (e && tri && tri.erreurs !== undefined && tri.erreurs !== null) e.value = String(tri.erreurs);
      });

      if (Array.isArray(data.auto)) {
        document.querySelectorAll('#autoEvalForm input[type="checkbox"]').forEach((checkbox) => {
          const label = checkbox.labels && checkbox.labels[0] ? checkbox.labels[0].innerText : checkbox.value;
          checkbox.checked = data.auto.includes(label) || data.auto.includes(checkbox.value);
        });
      }
      const comment = byId('autoComment');
      if (comment && !comment.value && typeof data.commentaire === 'string') comment.value = data.commentaire;
    }

    restoreAutoEvaluation();
    derivePosition();

    if (awaitingError === null && currentTri <= MAX_TRIS) {
      const savedLive = Number(sessionStorage.getItem(LIVE_KEY) || '0');
      if (Number.isFinite(savedLive) && savedLive > 0) chronoSeconds = Math.floor(savedLive);
    }

    updateChronoDisplay();
    persistTriData();

    if (sessionStorage.getItem(READY_KEY) === '1' && minimumTrisDone()) {
      const autoPart = byId('autoEvalPart');
      if (autoPart) {
        byId('consigne')?.style && (byId('consigne').style.display = 'none');
        autoPart.style.display = 'block';
        autoPart.classList.add('visible');
      }
      const validate = byId('seb-tri-auto-validate');
      if (validate) {
        validate.disabled = true;
        validate.textContent = 'Autoévaluation validée ✓';
      }
    }
  }

  function ensureDicteeCompleted() {
    try {
      const data = safeJson('dictee_data', null);
      const done = data && (data.status === 'verified' || data.status === 'abandoned');
      if (done) return true;
    } catch (_) {}
    window.location.replace('dictee.html');
    return false;
  }

  function installErrorHandlers() {
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      const input = byId('e' + i);
      if (!input) continue;

      input.addEventListener('input', () => {
        const value = validErrorValue(input.value);
        if (value === null && String(input.value || '').trim() !== '') {
          input.setCustomValidity('Saisissez un nombre entier positif ou 0.');
        } else {
          input.setCustomValidity('');
        }
        persistTriData();
        refreshResultsButton();
        refreshNextButton();
      });

      input.addEventListener('change', () => finalizeError(i));
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        finalizeError(i);
      });
    }
  }

  function install() {
    if (!ensureDicteeCompleted()) return;

    document.querySelectorAll('[id^="m"],[id^="s"]').forEach(() => {});
    for (let i = 1; i <= MAX_TRIS; i += 1) {
      const m = byId('m' + i);
      const s = byId('s' + i);
      if (m) m.readOnly = true;
      if (s) s.readOnly = true;
    }

    byId('startBtn')?.addEventListener('click', startChrono);
    byId('stopBtn')?.addEventListener('click', stopChrono);
    byId('calc')?.addEventListener('click', showResults);
    byId('seb-tri-auto-validate')?.addEventListener('click', validateAutoEvaluation);
    byId('seb-tri-next')?.addEventListener('click', navigateNext);

    installErrorHandlers();

    const comment = byId('autoComment');
    if (comment) comment.addEventListener('input', () => {
      saveAutoEval();
      refreshNextButton();
    });
    document.querySelectorAll('#autoEvalForm input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        saveAutoEval();
        refreshNextButton();
      });
    });

    restoreTri();
    updateControls();

    if (awaitingError !== null) {
      const errorInput = byId('e' + awaitingError);
      if (errorInput) setTimeout(() => errorInput.focus(), 0);
    }
  }

  window.sebEvalProTriNavigationReady = navigationReady;
  window.sebEvalProValidateTriAutoEvaluation = validateAutoEvaluation;

  const api = Object.freeze({
    startChrono,
    stopChrono,
    finalizeError,
    completedTriIndexes,
    minimumTrisDone,
    showResults,
    saveAutoEval,
    persistTriData,
    navigationReady,
    navigateNext,
    getCurrentTri: () => currentTri,
    getAwaitingError: () => awaitingError,
    getChronoSeconds: () => chronoSeconds
  });
  window.sebTri = api;

  // Compatibilité transitoire pour les couches historiques encore présentes.
  window.startChrono = startChrono;
  window.stopChrono = stopChrono;
  window.saveAutoEval = saveAutoEval;
  window.saveTriResultsToQCM = persistTriData;
  window.passerEtapeSuivante = navigateNext;
  window.sebEvalProShowTriResults = showResults;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
