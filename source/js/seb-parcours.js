(function () {
  'use strict';

  // Registre central du parcours candidat.
  // IMPORTANT : l'ordre ci-dessous décrit le parcours validé actuel.
  // Ajouter un exercice = ajouter une entrée ici, puis donner à la nouvelle
  // page son propre contrôleur appelant sebParcours.goNext('<id>').
  // Les pages non encore migrées continuent temporairement leur navigation
  // historique ; le registre permet leur migration progressive sans changer
  // les scénarios, consignes, réponses ou résultats existants.
  const steps = Object.freeze([
    Object.freeze({ id:'qcm-1', file:'qcmv1.0.html', page:'1' }),
    Object.freeze({ id:'qcm-2', file:'qcmv1.0.html', page:'2' }),
    Object.freeze({ id:'qcm-2_1', file:'qcmv1.0.html', page:'2_1' }),
    Object.freeze({ id:'qcm-3', file:'qcmv1.0.html', page:'3' }),
    Object.freeze({ id:'qcm-texte-trous', file:'qcmv1.0.html', page:'pageTexteTrous' }),
    Object.freeze({ id:'qcm-4', file:'qcmv1.0.html', page:'4' }),
    Object.freeze({ id:'qcm-5', file:'qcmv1.0.html', page:'5' }),
    Object.freeze({ id:'qcm-5_1', file:'qcmv1.0.html', page:'5_1' }),
    Object.freeze({ id:'qcm-6', file:'qcmv1.0.html', page:'6' }),

    Object.freeze({
      id:'autoeval1',
      file:'autoeval1.html',
      results:Object.freeze({
        storage:'autoEval1_resultats'
      })
    }),
    Object.freeze({ id:'introbrique', file:'introbrique.html' }),
    Object.freeze({
      id:'brique',
      file:'brique.html',
      results:Object.freeze({
        storage:'eval_brique',
        autoStorage:'eval_brique_auto',
        checkpointStorage:'seb_evalpro_brique_checkpoint'
      })
    }),
    Object.freeze({
      id:'stock',
      file:'stock.html',
      results:Object.freeze({
        correctStorage:'stockCorrect',
        errorStorage:'stockErrors',
        totalStorage:'stockTotal',
        stateStorage:'seb_evalpro_stock_state'
      })
    }),
    Object.freeze({
      id:'planning',
      file:'planning.html',
      results:Object.freeze({
        scoreStorage:'planningScore',
        correctionStorage:'planningCorrection',
        stateStorage:'seb_evalpro_planning_state',
        validatedStorage:'seb_planning_validated'
      })
    }),
    Object.freeze({ id:'genrenombres', file:'genrenombres.html' }),
    Object.freeze({
      id:'tri-de-cheville',
      file:'tri_de_cheville.html',
      results:Object.freeze({
        storage:'tri_cheville_data',
        autoStorage:'autoEvaltri_resultats'
      })
    }),

    // Contrat historique conservé : Résultats et bilan continuent de lire page7.
    Object.freeze({
      id:'nwtexte',
      file:'nwtexte.html',
      results:Object.freeze({
        scoreStorage:'scores_data',
        scoreKey:'page7',
        responseStorage:'reponses_data',
        responseKey:'page7_analyse'
      })
    }),

    // nvmail conserve son stockage historique page8_data.
    Object.freeze({
      id:'nvmail',
      file:'nvmail.html',
      results:Object.freeze({
        storage:'page8_data',
        scoreKey:'score_total'
      })
    }),

    Object.freeze({ id:'autoeval2', file:'autoeval2.html' }),
    Object.freeze({ id:'paronymes', file:'paronymes.html' }),
    Object.freeze({
      id:'carre',
      file:'carre.html',
      results:Object.freeze({
        scoreStorage:'carre_magique_score',
        errorStorage:'carre_magique_erreurs',
        displayStorage:'puzzleErrors'
      })
    }),

    Object.freeze({ id:'qcm-11', file:'qcmv1.0.html', page:'11' }),
    Object.freeze({ id:'qcm-finale', file:'qcmv1.0.html', page:'finale' })
  ]);

  function indexOf(id) {
    return steps.findIndex((step) => step.id === String(id || ''));
  }

  function stepFor(id) {
    return steps.find((step) => step.id === String(id || '')) || null;
  }

  function fileFor(id) {
    const step = stepFor(id);
    return step ? step.file : null;
  }

  function resultContractFor(id) {
    const step = stepFor(id);
    return step && step.results ? step.results : null;
  }

  function urlForStep(step) {
    if (!step) return null;
    if (!step.page) return step.file;
    const hash = step.page === 'finale' ? 'pageFinale' : (String(step.page).startsWith('page') ? step.page : 'page' + step.page);
    return step.file + '?page=' + encodeURIComponent(step.page) + '#' + hash;
  }

  function urlFor(id) {
    return urlForStep(stepFor(id));
  }

  function nextStep(currentId) {
    const index = indexOf(currentId);
    if (index < 0 || index + 1 >= steps.length) return null;
    return steps[index + 1];
  }

  // Compatibilité avec le premier pilote nwtexte et ses tests existants.
  // Pour une étape QCM interne, préférer nextUrl() afin de conserver ?page=...
  function nextFile(currentId) {
    const step = nextStep(currentId);
    return step ? step.file : null;
  }

  function nextUrl(currentId) {
    return urlForStep(nextStep(currentId));
  }

  function goTo(id) {
    const url = urlFor(id);
    if (!url) throw new Error('Étape de parcours inconnue : ' + id);
    window.location.href = url;
  }

  function goNext(currentId) {
    const url = nextUrl(currentId);
    if (!url) throw new Error('Aucune étape suivante configurée après : ' + currentId);
    window.location.href = url;
  }

  window.sebParcours = Object.freeze({
    steps,
    stepFor,
    fileFor,
    urlFor,
    resultContractFor,
    nextStep,
    nextFile,
    nextUrl,
    goTo,
    goNext
  });
})();
