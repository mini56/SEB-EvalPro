(function () {
  'use strict';

  const DATA_KEY = 'eval_brique';
  const AUTO_KEY = 'eval_brique_auto';
  const CHECKPOINT_KEY = 'seb_evalpro_brique_checkpoint';
  const PERIOD_SECONDS = 1;

  let chronoInterval = null;
  let chronoSeconds = 0;
  let lastSavedBucket = 0;

  function persistCandidate() {
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
  }

  function updateChrono() {
    const minutes = document.getElementById('chrono-min');
    const seconds = document.getElementById('chrono-sec');
    if (minutes) minutes.textContent = String(Math.floor(chronoSeconds / 60)).padStart(2, '0');
    if (seconds) seconds.textContent = String(chronoSeconds % 60).padStart(2, '0');
  }

  function persistCheckpoint(force) {
    if (!Number.isFinite(chronoSeconds) || chronoSeconds <= 0) return false;
    const bucket = Math.floor(chronoSeconds / PERIOD_SECONDS);
    if (!force && bucket <= lastSavedBucket) return false;
    lastSavedBucket = bucket;
    sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
      chronoSeconds: Math.floor(chronoSeconds),
      savedAt: Date.now()
    }));
    persistCandidate();
    return true;
  }

  function restoreCheckpoint() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY) || 'null'); } catch (_) {}
    const seconds = Number(saved && saved.chronoSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return false;
    chronoSeconds = Math.floor(seconds);
    lastSavedBucket = Math.floor(chronoSeconds / PERIOD_SECONDS);
    updateChrono();
    return true;
  }

  function startChrono() {
    if (chronoInterval) return false;
    chronoInterval = setInterval(() => {
      chronoSeconds += 1;
      updateChrono();
      persistCheckpoint(false);
    }, 1000);
    const start = document.getElementById('startBtn');
    const stop = document.getElementById('stopBtn');
    if (start) start.disabled = true;
    if (stop) stop.disabled = false;
    return true;
  }

  function stopChrono() {
    if (!chronoInterval) return false;
    clearInterval(chronoInterval);
    chronoInterval = null;
    updateChrono();
    const temps = document.getElementById('temps');
    if (temps) {
      const min = document.getElementById('chrono-min')?.textContent || '00';
      const sec = document.getElementById('chrono-sec')?.textContent || '00';
      temps.value = min + ':' + sec;
    }
    const start = document.getElementById('startBtn');
    const stop = document.getElementById('stopBtn');
    if (start) start.disabled = false;
    if (stop) stop.disabled = true;
    persistCheckpoint(true);
    return true;
  }

  function codeIsValid() {
    return (document.getElementById('secretCode')?.value || '').trim().toLowerCase() === 'svg56';
  }

  function checkInputs() {
    const errInput = document.getElementById('nivDiff');
    const codeInput = document.getElementById('secretCode');
    const validBtn = document.getElementById('validBtn');
    const msgDiv = document.getElementById('msg');
    const rawCode = (codeInput?.value || '').trim();
    const errFilled = (errInput?.value || '').trim() !== '';
    const codeValid = rawCode.toLowerCase() === 'svg56';

    if (validBtn) validBtn.disabled = !codeValid;
    if (!msgDiv) return codeValid;

    if (!rawCode) msgDiv.textContent = '';
    else if (!codeValid && rawCode.length >= 5) msgDiv.textContent = 'Code incorrect !';
    else if (codeValid && !errFilled) msgDiv.textContent = 'Code correct — renseignez le nombre d’erreurs.';
    else if (codeValid) msgDiv.textContent = 'Code correct.';
    else msgDiv.textContent = '';
    return codeValid;
  }

  function readMainEvaluation() {
    return {
      temps: document.getElementById('temps')?.value || '',
      niveau: document.getElementById('nivDiff')?.value || '',
      code: document.getElementById('secretCode')?.value || ''
    };
  }

  function saveMainEvaluation() {
    const data = readMainEvaluation();
    sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
    persistCandidate();
    return data;
  }

  function revealAutoEvaluation(immediate) {
    const consigne = document.getElementById('consigne');
    const autoEvalPart = document.getElementById('autoEvalPart');
    if (!consigne || !autoEvalPart) return;

    const show = () => {
      consigne.style.display = 'none';
      autoEvalPart.style.display = 'block';
      autoEvalPart.classList.add('visible');
      if (!immediate) autoEvalPart.scrollIntoView({ behavior: 'smooth' });
    };

    consigne.classList.add('fade-out');
    if (immediate) show();
    else setTimeout(show, 1000);
  }

  function validateMainEvaluation() {
    const errInput = document.getElementById('nivDiff');
    const codeInput = document.getElementById('secretCode');
    const msgDiv = document.getElementById('msg');

    if (!codeIsValid()) {
      if (msgDiv) msgDiv.textContent = 'Code incorrect !';
      codeInput?.focus();
      return false;
    }
    if ((errInput?.value || '').trim() === '') {
      if (msgDiv) msgDiv.textContent = 'Renseignez le nombre d’erreurs avant de valider.';
      errInput?.focus();
      return false;
    }

    saveMainEvaluation();
    revealAutoEvaluation(false);
    return true;
  }

  function readAutoEvaluation() {
    const choix = Array.from(document.querySelectorAll("#autoEvalForm input[type='checkbox']:checked"))
      .map((cb) => cb.value);
    const commentaire = (document.getElementById('autoComment')?.value || '').trim();
    return { choix, commentaire };
  }

  function saveAutoEvaluation() {
    const data = readAutoEvaluation();
    sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));
    persistCandidate();
    return data;
  }

  function restoreMainEvaluation() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(DATA_KEY) || 'null'); } catch (_) {}
    if (!data) return null;

    const temps = document.getElementById('temps');
    const errors = document.getElementById('nivDiff');
    if (temps && !temps.value && typeof data.temps === 'string') temps.value = data.temps;
    if (errors && errors.value === '' && data.niveau !== undefined && data.niveau !== null) errors.value = String(data.niveau);

    const match = typeof data.temps === 'string' ? data.temps.match(/^(\d+):(\d{2})$/) : null;
    if (match) {
      const seconds = Number(match[1]) * 60 + Number(match[2]);
      if (Number.isFinite(seconds) && seconds > chronoSeconds) {
        chronoSeconds = seconds;
        updateChrono();
      }
    }

    revealAutoEvaluation(true);
    return data;
  }

  function restoreAutoEvaluation() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(AUTO_KEY) || 'null'); } catch (_) {}
    if (!data) return null;

    const selected = new Set(Array.isArray(data.choix) ? data.choix : []);
    document.querySelectorAll("#autoEvalForm input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.value);
    });
    const comment = document.getElementById('autoComment');
    if (comment && !comment.value && typeof data.commentaire === 'string') comment.value = data.commentaire;
    return data;
  }

  function completeAutoEvaluation() {
    saveAutoEvaluation();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('brique');
    return true;
  }

  function install() {
    restoreCheckpoint();
    restoreMainEvaluation();
    restoreAutoEvaluation();
    updateChrono();

    document.getElementById('startBtn')?.addEventListener('click', startChrono);
    document.getElementById('stopBtn')?.addEventListener('click', stopChrono);
    document.getElementById('nivDiff')?.addEventListener('input', checkInputs);
    document.getElementById('secretCode')?.addEventListener('input', checkInputs);
    document.getElementById('validBtn')?.addEventListener('click', validateMainEvaluation);
    document.getElementById('autoEvalBtn')?.addEventListener('click', completeAutoEvaluation);
    checkInputs();
  }

  const api = Object.freeze({
    startChrono,
    stopChrono,
    updateChrono,
    persistCheckpoint,
    restoreCheckpoint,
    checkInputs,
    readMainEvaluation,
    saveMainEvaluation,
    validateMainEvaluation,
    revealAutoEvaluation,
    readAutoEvaluation,
    saveAutoEvaluation,
    restoreMainEvaluation,
    restoreAutoEvaluation,
    completeAutoEvaluation,
    getChronoSeconds: () => chronoSeconds
  });
  window.sebBrique = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
