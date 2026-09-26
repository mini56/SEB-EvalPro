(function () {
  'use strict';

  const STORAGE_KEY = 'page8_data';
  const EMAIL_TO = 'conseil.perso@sauvegarde56.org';
  const EMAIL_CC = 'stage-pro@sauvegarde56.org';
  const CORRECT_FILE = 'Rapport_stage.docx';

  // SEB_SIGNATURE_CANDIDAT_NORMALISEE
  function normaliserIdentiteMail(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr-FR')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function signatureCandidatValide(message, prenomCandidat, nomCandidat) {
    const messageNormalise = normaliserIdentiteMail(message);
    const prenomNormalise = normaliserIdentiteMail(prenomCandidat);
    const nomNormalise = normaliserIdentiteMail(nomCandidat);
    if (!messageNormalise || !prenomNormalise || !nomNormalise) return false;

    const prenomNom = (prenomNormalise + ' ' + nomNormalise).trim();
    const nomPrenom = (nomNormalise + ' ' + prenomNormalise).trim();
    return messageNormalise.includes(prenomNom) || messageNormalise.includes(nomPrenom);
  }

  function objetMailCandidatValide(subject, prenomCandidat) {
    const objet = normaliserIdentiteMail(subject);
    const prenom = normaliserIdentiteMail(prenomCandidat);
    if (!objet || !prenom) return false;
    return objet === (prenom + ' mail seb').trim();
  }

  function telephoneMailValide(message) {
    const texte = String(message || '');
    return /(^|[^\d])0\d(?:[\s.,\/-]?\d{2}){4}(?!\d)/.test(texte);
  }

  function getPrenomCandidat() {
    try {
      const candidatData = sessionStorage.getItem('candidat_data');
      if (candidatData) {
        const data = JSON.parse(candidatData);
        if (data.prénom) return data.prénom;
      }
      const stored = sessionStorage.getItem('candidat_prenom');
      if (stored) return stored;
    } catch (error) {
      console.error('Erreur récupération prénom:', error);
    }

    const prenomURL = new URLSearchParams(window.location.search).get('prenom');
    return prenomURL || '';
  }

  function getNomCandidat() {
    try {
      const candidatData = sessionStorage.getItem('candidat_data');
      if (candidatData) {
        const data = JSON.parse(candidatData);
        if (data.nom) return data.nom;
      }
      const stored = sessionStorage.getItem('candidat_nom');
      if (stored) return stored;
    } catch (error) {
      console.error('Erreur récupération nom:', error);
    }

    const nomURL = new URLSearchParams(window.location.search).get('nom');
    return nomURL || '';
  }

  function readForm() {
    return {
      to: document.getElementById('to')?.value.trim() || '',
      cc: document.getElementById('cc')?.value.trim() || '',
      subject: document.getElementById('subject')?.value.trim() || '',
      message: document.getElementById('message')?.value.trim() || '',
      file: document.getElementById('fichierSelectionne')?.textContent.trim() || ''
    };
  }

  function saveEmailAnswers(to, cc, subject, message, file) {
    const prenomCandidat = getPrenomCandidat();
    const nomCandidat = getNomCandidat();

    // Les adresses sont volontairement strictes et sensibles à la casse.
    const score_to = (String(to || '').trim() === 'conseil.perso@sauvegarde56.org') ? 1 : 0;
    const score_cc = (String(cc || '').trim() === 'stage-pro@sauvegarde56.org') ? 1 : 0;
    const score_subject = objetMailCandidatValide(subject, prenomCandidat) ? 1 : 0;
    const score_file = (file === CORRECT_FILE) ? 1 : 0;
    const score_signature = signatureCandidatValide(message, prenomCandidat, nomCandidat) ? 1 : 0;
    const score_telephone = telephoneMailValide(message) ? 1 : 0;
    const score_total = score_to + score_cc + score_subject + score_file + score_signature + score_telephone;

    const data = {
      page8_to: to,
      page8_cc: cc,
      page8_subject: subject,
      page8_message: message,
      page8_file: file,
      score_to,
      score_cc,
      score_subject,
      score_file,
      score_signature,
      score_telephone,
      score_total
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('✅ Données page 8 sauvegardées:', data);
    console.log('📊 Score total: ' + score_total + '/6');
    return data;
  }

  function saveCurrent() {
    const value = readForm();
    return saveEmailAnswers(value.to, value.cc, value.subject, value.message, value.file);
  }

  function evaluerFormulaire(event) {
    if (event) event.preventDefault();
    saveCurrent();

    const resultat = document.getElementById('resultatScore');
    if (resultat) {
      resultat.innerHTML = '<h3 style="text-align: left; margin-top: 20px; padding: 15px; background: #1a73e8; color: white; border-radius: 6px;">Message envoyé ! 👍</h3>';
      resultat.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
    return false;
  }

  function ouvrirFichierModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('modalFichier');
    if (overlay) overlay.style.display = 'block';
    if (modal) modal.style.display = 'block';
  }

  function fermerFichierModal() {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById('modalFichier');
    if (overlay) overlay.style.display = 'none';
    if (modal) modal.style.display = 'none';
  }

  function choisirFichier(nomFichier) {
    const selected = document.getElementById('fichierSelectionne');
    if (selected) selected.textContent = nomFichier;
    fermerFichierModal();
  }

  function restorePage8Data() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
    if (!data) return;

    const to = document.getElementById('to');
    const cc = document.getElementById('cc');
    const subject = document.getElementById('subject');
    const message = document.getElementById('message');
    const file = document.getElementById('fichierSelectionne');

    if (to && !to.value && data.page8_to) to.value = data.page8_to;
    if (cc && !cc.value && data.page8_cc) cc.value = data.page8_cc;
    if (subject && !subject.value && data.page8_subject) subject.value = data.page8_subject;
    if (message && !message.value && data.page8_message) message.value = data.page8_message;
    if (file && (!file.textContent.trim() || file.textContent.trim() === 'Aucun fichier sélectionné') && data.page8_file) {
      file.textContent = data.page8_file;
    }
  }

  function navigateNext() {
    saveCurrent();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('nvmail');
  }

  function goToPage(pageName) {
    saveCurrent();
    window.location.href = pageName;
  }

  function install() {
    document.getElementById('formEmail')?.addEventListener('submit', evaluerFormulaire);
    document.getElementById('overlay')?.addEventListener('click', fermerFichierModal);
    document.getElementById('nvmail-file-picker')?.addEventListener('click', ouvrirFichierModal);
    document.querySelectorAll('#modalFichier [data-seb-file]').forEach((item) => {
      item.addEventListener('click', () => choisirFichier(item.dataset.sebFile));
    });
    document.getElementById('nvmail-skip')?.addEventListener('click', navigateNext);
    document.getElementById('nvmail-next')?.addEventListener('click', navigateNext);
    restorePage8Data();
  }

  const api = Object.freeze({
    normaliserIdentiteMail,
    signatureCandidatValide,
    objetMailCandidatValide,
    telephoneMailValide,
    getPrenomCandidat,
    getNomCandidat,
    saveEmailAnswers,
    saveCurrent,
    evaluerFormulaire,
    ouvrirFichierModal,
    fermerFichierModal,
    choisirFichier,
    restorePage8Data,
    navigateNext
  });
  window.sebNvmail = api;

  // Compatibilité transitoire pour les couches historiques encore présentes.
  window.evaluerFormulaire = evaluerFormulaire;
  window.ouvrirFichierModal = ouvrirFichierModal;
  window.fermerFichierModal = fermerFichierModal;
  window.choisirFichier = choisirFichier;
  window.passerVersAutoEval = navigateNext;
  window.nextPage = navigateNext;
  window.goToPage = goToPage;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
