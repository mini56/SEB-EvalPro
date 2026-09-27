(function () {
  'use strict';

  const FINAL_PAGE_ID = 'pageFinale';
  const RESULT_ID = 'resultat';
  const END_MESSAGE_ID = 'seb-candidate-end-message';
  const ADMIN_BUTTON_ID = 'seb-evalpro-admin';

  let pageObserver = null;
  let adminObserver = null;
  let adminButtonObserved = null;
  let retryTimer = null;

  function normalizeLabel(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^[^A-Za-zÀ-ÿ]+/u, '')
      .trim()
      .toLowerCase();
  }

  function isAdminUnlocked() {
    const button = document.getElementById(ADMIN_BUTTON_ID);
    const label = normalizeLabel(button && button.textContent);
    return /^verrouiller\b/.test(label);
  }

  function finalPage() {
    return document.getElementById(FINAL_PAGE_ID);
  }

  function resultNode() {
    return document.getElementById(RESULT_ID);
  }

  function isFinalVisible() {
    const page = finalPage();
    return !!(page && page.classList.contains('visible'));
  }

  function ensureEndMessage() {
    const page = finalPage();
    const result = resultNode();
    if (!page || !result) return null;

    let message = document.getElementById(END_MESSAGE_ID);
    if (!message) {
      message = document.createElement('div');
      message.id = END_MESSAGE_ID;
      message.style.cssText =
        'max-width:760px;margin:35px auto;padding:28px;border:1px solid #9cc2e5;' +
        'border-radius:8px;background:#f7fbff;text-align:center;font-size:20px;' +
        'line-height:1.5;color:#1f4e79;';
      message.innerHTML =
        '<strong>Votre évaluation est terminée.</strong><br>' +
        '<span style="font-size:16px;color:#444">Merci. Vous pouvez maintenant prévenir l’administrateur.</span>';
      result.insertAdjacentElement('beforebegin', message);
    }
    return message;
  }

  function syncPageScrollPolicy() {
    const root = document.documentElement;
    const resultsVisible = isFinalVisible();
    root.classList.toggle('seb-results-page-scroll', resultsVisible);
    root.classList.toggle('seb-candidate-no-page-scroll', !resultsVisible);
    return resultsVisible;
  }

  function applyFinalAccess() {
    const page = finalPage();
    const result = resultNode();
    if (!page || !result) return false;

    const heading = page.querySelector('h2');
    const message = ensureEndMessage();
    const admin = isAdminUnlocked();

    result.hidden = !admin;
    result.style.display = admin ? '' : 'none';
    if (message) message.hidden = admin;
    if (heading) heading.textContent = admin ? 'Résultats du test' : 'Fin de l’évaluation';

    syncPageScrollPolicy();
    return admin;
  }

  function attachPageObserver() {
    const page = finalPage();
    if (!page || pageObserver) return !!pageObserver;
    pageObserver = new MutationObserver(function () {
      applyFinalAccess();
    });
    pageObserver.observe(page, { attributes:true, attributeFilter:['class'] });
    return true;
  }

  function attachAdminObserver() {
    const button = document.getElementById(ADMIN_BUTTON_ID);
    if (!button) return false;
    if (adminButtonObserved === button && adminObserver) return true;

    if (adminObserver) adminObserver.disconnect();
    adminButtonObserved = button;
    adminObserver = new MutationObserver(function () {
      applyFinalAccess();
    });
    adminObserver.observe(button, { childList:true, characterData:true, subtree:true });
    if (button.dataset.sebResultAccessWatch !== '1') {
      button.dataset.sebResultAccessWatch = '1';
      button.addEventListener('click', function () {
        setTimeout(applyFinalAccess, 80);
      });
    }
    return true;
  }

  function scheduleAdminWatch() {
    if (attachAdminObserver()) return;
    if (retryTimer) return;
    let tries = 0;
    retryTimer = setInterval(function () {
      tries += 1;
      applyFinalAccess();
      if (attachAdminObserver() || tries >= 30) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 150);
  }

  function refresh() {
    ensureEndMessage();
    attachPageObserver();
    scheduleAdminWatch();
    return applyFinalAccess();
  }

  function install() {
    refresh();
    window.addEventListener('pageshow', refresh);
  }

  window.sebQcmFinal = Object.freeze({
    normalizeLabel,
    isAdminUnlocked,
    isFinalVisible,
    ensureEndMessage,
    syncPageScrollPolicy,
    applyFinalAccess,
    refresh
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
