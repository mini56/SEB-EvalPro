(function () {
  'use strict';

  const STORAGE_KEY = 'autoEval2_resultats';

  function readForm() {
    const form = document.getElementById('autoEvalForm');
    const selections = form
      ? Array.from(form.querySelectorAll("input[type='checkbox']:checked")).map((checkbox) => checkbox.value)
      : [];
    const commentaire = (document.getElementById('autoCommentoutils')?.value || '').trim();
    return { selections, commentaire };
  }

  function writeFeedback(data) {
    const resultDiv = document.getElementById('autoEvalResult');
    if (!resultDiv) return;
    if ((!data.selections || data.selections.length === 0) && !data.commentaire) {
      resultDiv.style.color = 'red';
      resultDiv.textContent = 'Aucune sélection effectuée.';
    } else {
      resultDiv.style.color = 'green';
      resultDiv.textContent = 'Autoévaluation enregistrée avec succès.';
    }
  }

  function saveEvaluation() {
    const data = readForm();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('✅ Autoévaluation enregistrée :', data);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde :', error);
    }
    writeFeedback(data);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
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

    const comment = document.getElementById('autoCommentoutils');
    if (comment && !comment.value && typeof data.commentaire === 'string') comment.value = data.commentaire;
    return data;
  }

  function navigateNext() {
    saveEvaluation();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('autoeval2');
  }

  function install() {
    document.getElementById('autoeval2-validate')?.addEventListener('click', navigateNext);
    document.getElementById('autoeval2-skip')?.addEventListener('click', navigateNext);
    restoreEvaluation();
  }

  const api = Object.freeze({ readForm, saveEvaluation, restoreEvaluation, navigateNext });
  window.sebAutoEval2 = api;

  window.saveAutoEval2 = navigateNext;
  window.passAutoEval2 = navigateNext;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
