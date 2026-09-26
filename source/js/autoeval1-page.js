(function () {
  'use strict';

  const STORAGE_KEY = 'autoEval1_resultats';

  function readForm() {
    const form = document.getElementById('autoEvalForm');
    const selections = form
      ? Array.from(form.querySelectorAll("input[type='checkbox']:checked")).map((checkbox) => checkbox.value)
      : [];
    const commentaire = (document.getElementById('autoComment')?.value || '').trim();
    return { selections, commentaire };
  }

  function hasResponse(data) {
    return Boolean((data.selections && data.selections.length) || data.commentaire);
  }

  function saveEvaluation() {
    const data = readForm();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    console.log('✅ Données autoévaluation 1 enregistrées :', data.selections, data.commentaire);
    return data;
  }

  function restoreEvaluation() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    if (!data) return null;

    const selected = new Set(Array.isArray(data.selections) ? data.selections : []);
    document.querySelectorAll("#autoEvalForm input[type='checkbox']").forEach((checkbox) => {
      checkbox.checked = selected.has(checkbox.value);
    });

    const comment = document.getElementById('autoComment');
    if (comment && !comment.value && typeof data.commentaire === 'string') comment.value = data.commentaire;
    return data;
  }

  function goNext() {
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('autoeval1');
  }

  function validateAndNext() {
    const data = saveEvaluation();
    if (!hasResponse(data)) {
      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');
      return false;
    }
    goNext();
    return true;
  }

  function confirmAndNext() {
    if (!window.confirm('Souhaitez-vous passer à l’étape suivante ?')) return false;
    return validateAndNext();
  }

  function install() {
    document.getElementById('autoeval1-validate')?.addEventListener('click', validateAndNext);
    document.getElementById('autoeval1-next')?.addEventListener('click', confirmAndNext);
    restoreEvaluation();
  }

  const api = Object.freeze({
    readForm,
    hasResponse,
    saveEvaluation,
    restoreEvaluation,
    validateAndNext,
    confirmAndNext,
    goNext
  });
  window.sebAutoEval1 = api;

  // Compatibilité transitoire avec les couches historiques encore présentes.
  window.saveAutoEval1 = saveEvaluation;
  window.passerEtapeSuivante = confirmAndNext;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
