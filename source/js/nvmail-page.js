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

  function isCompletelyEmptyMail(value) {
    const data = value || {};
    const file = String(data.file || '').trim();
    const noFile = !file || file === 'Aucun fichier sélectionné';
    return !String(data.to || '').trim()
      && !String(data.cc || '').trim()
      && !String(data.subject || '').trim()
      && !String(data.message || '').trim()
      && noFile;
  }

  function ensureEmptySendPromptStyle() {
    if (document.getElementById('seb-nvmail-empty-send-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-nvmail-empty-send-style';
    style.textContent = `
      #seb-nvmail-empty-send-layer{
        position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.46);
        display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;
        font-family:Arial,sans-serif;
      }
      #seb-nvmail-empty-send-box{
        width:min(560px,94vw);background:#fff;border:1px solid #aaa;border-radius:12px;
        padding:22px;box-shadow:0 16px 48px rgba(0,0,0,.32);color:#202020;
      }
      #seb-nvmail-empty-send-box h2{margin:0 0 12px;color:#1a73e8;font-size:22px}
      #seb-nvmail-empty-send-box p{margin:0;font-size:16px;line-height:1.45}
      #seb-nvmail-empty-send-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;flex-wrap:wrap}
      #seb-nvmail-empty-send-actions button{
        min-height:42px;padding:0 16px;border-radius:8px;font-family:Arial,sans-serif;
        font-size:14px;font-weight:700;cursor:pointer;
      }
      #seb-nvmail-empty-stay{background:#fff;color:#1a73e8;border:2px solid #1a73e8}
      #seb-nvmail-empty-abandon{background:#c62828;color:#fff;border:2px solid #c62828}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function openEmptySendAbandonPrompt() {
    if (document.getElementById('seb-nvmail-empty-send-layer')) return;
    ensureEmptySendPromptStyle();

    const layer = document.createElement('div');
    layer.id = 'seb-nvmail-empty-send-layer';
    layer.innerHTML = `
      <div id="seb-nvmail-empty-send-box" role="dialog" aria-modal="true" aria-label="Message vide">
        <h2>Message vide</h2>
        <p>Vous n’avez rien saisi. Voulez-vous passer à l’exercice suivant ?</p>
        <div id="seb-nvmail-empty-send-actions">
          <button type="button" id="seb-nvmail-empty-stay">Non – Rester sur cette page</button>
          <button type="button" id="seb-nvmail-empty-abandon">Oui – Abandonner l’exercice</button>
        </div>
      </div>
    `;
    document.body.appendChild(layer);

    const close = () => layer.remove();
    layer.querySelector('#seb-nvmail-empty-stay')?.addEventListener('click', close);
    layer.querySelector('#seb-nvmail-empty-abandon')?.addEventListener('click', () => {
      close();
      setTimeout(() => {
        const abandonButton = document.getElementById('seb-evalpro-abandon-fixed');
        if (abandonButton) abandonButton.click();
      }, 0);
    });
    layer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
    layer.querySelector('#seb-nvmail-empty-stay')?.focus();
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
    const value = readForm();

    if (isCompletelyEmptyMail(value)) {
      openEmptySendAbandonPrompt();
      return false;
    }

    saveEmailAnswers(value.to, value.cc, value.subject, value.message, value.file);

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
    isCompletelyEmptyMail,
    openEmptySendAbandonPrompt,
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
