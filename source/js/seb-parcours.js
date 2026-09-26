(function () {
  'use strict';

  // Registre central du parcours. Les pages migrées utilisent uniquement leur id.
  // Pour insérer demain un exercice entre nwtexte et nvmail, ajouter simplement
  // { id:'nwexercice', file:'nwexercice.html' } entre ces deux entrées.
  const steps = Object.freeze([
    Object.freeze({ id:'nwtexte', file:'nwtexte.html' }),
    Object.freeze({ id:'nvmail', file:'nvmail.html' })
  ]);

  function indexOf(id) {
    return steps.findIndex((step) => step.id === String(id || ''));
  }

  function fileFor(id) {
    const step = steps.find((item) => item.id === String(id || ''));
    return step ? step.file : null;
  }

  function nextFile(currentId) {
    const index = indexOf(currentId);
    if (index < 0 || index + 1 >= steps.length) return null;
    return steps[index + 1].file;
  }

  function goTo(id) {
    const file = fileFor(id);
    if (!file) throw new Error('Étape de parcours inconnue : ' + id);
    window.location.href = file;
  }

  function goNext(currentId) {
    const file = nextFile(currentId);
    if (!file) throw new Error('Aucune étape suivante configurée après : ' + currentId);
    window.location.href = file;
  }

  window.sebParcours = Object.freeze({
    steps,
    fileFor,
    nextFile,
    goTo,
    goNext
  });
})();
