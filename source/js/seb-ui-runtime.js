(function () {
  'use strict';

  const ABANDON_KEY = 'seb_evalpro_abandons';
  const EXERCISE_FILES = new Set([
    'brique.html',
    'stock.html',
    'planning.html',
    'genrenombres.html',
    'dictee.html',
    'tri_de_cheville.html',
    'nwtexte.html',
    'nvmail.html',
    'paronymes.html',
    'carre.html'
  ]);

  const NEXT_BY_FILE = {
    'brique.html': 'stock.html',
    'stock.html': 'planning.html',
    'planning.html': 'genrenombres.html',
    'genrenombres.html': 'dictee.html',
    'dictee.html': 'tri_de_cheville.html',
    'tri_de_cheville.html': 'nwtexte.html',
    'nwtexte.html': 'nvmail.html',
    'nvmail.html': 'autoeval2.html',
    'paronymes.html': 'carre.html',
    'carre.html': 'qcmv1.0.html?page=11#page11'
  };

  const EXERCISE_LABELS = {
    'brique.html': 'Construction à base de briques',
    'stock.html': 'Gestion logistique — Ranger le stock produit',
    'planning.html': 'Planification — Le restaurant',
    'genrenombres.html': 'Genre et nombre',
    'dictee.html': 'Dictée',
    'tri_de_cheville.html': 'Tri de chevilles',
    'nwtexte.html': 'Traitement de texte',
    'nvmail.html': 'Messagerie électronique',
    'paronymes.html': 'Paronymes',
    'carre.html': 'Carré magique / Puzzle Gratte-ciel'
  };

  const QCM_LABELS = {
    page1: 'Exercice QCM',
    page2: 'Calculs',
    page2_1: 'Calculs — suite',
    page3: 'Réception / contrôle',
    page4: 'Fractions',
    page5: 'Ordonnancement',
    page5_1: 'Postures',
    page6: 'Conversions',
    pageTexteTrous: 'Texte à trous',
    page8: 'Messagerie',
    page9: 'Exercice QCM',
    page10: 'Exercice QCM',
    page11: 'Exercice QCM'
  };

  const QCM_EXCLUDED = new Set(['page0', 'pageFinale', 'bilanPage']);
  const QCM_EXERCISE_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);
  let mutationScheduled = false;

  function pageName() {
    try {
      return decodeURIComponent((window.location.pathname.split('/').pop() || '').toLowerCase());
    } catch (_) {
      return '';
    }
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
  }

  function stripActionIcon(value) {
    return cleanText(value)
      .replace(/^(?:➡️|➡|➜|→|←|✓|✔|🔍|📊|🧮|💾|✉️|✉|📧|▶️|▶|⏹️|⏹|■|✕|❌|📂|⬇️|⬇)\s*/u, '')
      .replace(/\s*(?:->|→|➜)\s*$/u, '')
      .trim();
  }

  function ensureStyles() {
    if (document.getElementById('seb-evalpro-unified-buttons-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-evalpro-unified-buttons-style';
    style.textContent = `
      .seb-action-btn{
        min-height:42px!important;
        padding:0 18px!important;
        border:0!important;
        border-radius:8px!important;
        color:#fff!important;
        font-family:Arial,sans-serif!important;
        font-size:15px!important;
        font-weight:700!important;
        line-height:1.15!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        box-sizing:border-box!important;
        cursor:pointer!important;
        text-decoration:none!important;
        box-shadow:0 2px 5px rgba(0,0,0,.18)!important;
        transition:filter .15s ease,transform .08s ease!important;
        vertical-align:middle!important;
      }
      .seb-action-btn:hover{filter:brightness(.92)!important}
      .seb-action-btn:active{transform:translateY(1px)!important}
      .seb-action-btn:disabled{opacity:.5!important;cursor:not-allowed!important;filter:none!important;transform:none!important}
      .seb-btn-nav{background:#1a73e8!important}
      .seb-btn-confirm{background:#198754!important}
      .seb-btn-tool{background:#e67e22!important}
      .seb-btn-danger{background:#c62828!important}
      #seb-evalpro-abandon-fixed{
        position:fixed!important;
        left:16px!important;
        bottom:16px!important;
        z-index:2147483000!important;
        min-width:220px!important;
      }
      #seb-evalpro-abandon-layer{
        position:fixed;
        inset:0;
        z-index:2147483647;
        background:rgba(0,0,0,.46);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
      }
      #seb-evalpro-abandon-box{
        width:min(560px,94vw);
        background:#fff;
        border:1px solid #aaa;
        border-radius:12px;
        padding:22px;
        box-shadow:0 16px 48px rgba(0,0,0,.32);
        color:#202020;
      }
      #seb-evalpro-abandon-box h2{margin:0 0 8px;color:#c62828;font-size:22px}
      #seb-evalpro-abandon-box .seb-abandon-exercise{font-weight:700;margin-bottom:14px;color:#1a3a5f}
      #seb-evalpro-abandon-box .seb-abandon-help{margin:0 0 12px;font-size:14px;line-height:1.4}
      #seb-evalpro-abandon-box .seb-abandon-choice{display:flex;align-items:flex-start;gap:10px;padding:8px 4px;font-size:15px}
      #seb-evalpro-abandon-box .seb-abandon-choice input{margin-top:2px;transform:scale(1.15)}
      #seb-evalpro-abandon-comment{width:100%;min-height:78px;margin-top:10px;padding:8px;border:1px solid #aaa;border-radius:7px;box-sizing:border-box;font:14px Arial,sans-serif;resize:vertical}
      .seb-abandon-admin{margin-top:14px;padding:11px;border:1px solid #d7dce5;border-radius:7px;background:#f7f9fc}.seb-abandon-admin label{display:block;font-weight:700;color:#1a3a5f;margin-bottom:6px}.seb-abandon-admin small{display:block;color:#666;margin-top:5px}.seb-abandon-admin input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #999;border-radius:5px;font:16px Arial,sans-serif}
      #seb-evalpro-abandon-error{min-height:19px;margin-top:6px;color:#c62828;font-size:13px;font-weight:700}
      #seb-evalpro-abandon-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
      .seb-admin-abandon-section td{background:#f7c8c8!important;color:#7c1111!important;font-weight:700!important}
      .seb-admin-abandon-row .seb-admin-abandon-state{background:#c62828!important;color:#fff!important;text-align:center!important;font-weight:700!important;vertical-align:middle!important}
      .seb-admin-abandon-row .seb-admin-abandon-comment{white-space:pre-line!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function skipButton(button) {
    return !!button.closest(
      '#toolbar,.toolbar-row2,.ql-toolbar,#calc-container,#seb-evalpro-topbar,' +
      '#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer,' +
      '#page4 .fraction-title,#page4 .items-wrapper'
    );
  }

  function buttonKind(label) {
    const value = label.toLowerCase();
    if (/abandon|supprim|réinitial|reinitial|remise à zéro|remise a zero|fermer cette session/.test(value)) return 'danger';
    if (/valider|vérifier|verifier|démarrer|demarrer|envoyer|compléter automatiquement|completer automatiquement/.test(value)) return 'confirm';
    if (/calculatrice|enregistrer|exporter|imprimer|stop|arrêter|arreter|ouvrir/.test(value)) return 'tool';
    return 'nav';
  }

  function iconizedLabel(label) {
    const clean = stripActionIcon(label);
    const value = clean.toLowerCase();
    if (/^abandon/.test(value)) return '⏹ Abandonner l’exercice';
    if (/^démarrer|^demarrer/.test(value)) return '▶ ' + clean;
    if (/^valider|^vérifier|^verifier|^compléter automatiquement|^completer automatiquement/.test(value)) return '✓ ' + clean;
    if (/^envoyer/.test(value)) return '✉ ' + clean;
    if (/calculatrice/.test(value)) return '🧮 Ouvrir la calculatrice';
    if (/^enregistrer/.test(value)) return '💾 ' + clean;
    if (/^exporter/.test(value)) return '⬇ ' + clean;
    if (/^imprimer/.test(value)) return '⬇ ' + clean;
    if (/^voir les résultats|^voir les resultats/.test(value)) return '📊 Voir les résultats';
    if (/^retour/.test(value)) return '← ' + clean;
    if (/^suivant|^page suivante|^étape suivante|^etape suivante|^continuer/.test(value)) return '➜ ' + clean;
    if (/^stop|^arrêter|^arreter/.test(value)) return '■ ' + clean;
    if (/^fermer/.test(value)) return '✕ ' + clean;
    if (/^annuler/.test(value)) return '✕ ' + clean;
    return clean;
  }

  function normalizeButton(button) {
    if (!button || button.nodeType !== 1 || skipButton(button)) return;
    if (button.id === 'seb-evalpro-abandon-fixed') return;
    const raw = cleanText(button.textContent);
    if (!raw) return;
    const label = stripActionIcon(raw);
    const kind = buttonKind(label);
    const desiredKind = 'seb-btn-' + kind;
    for (const cls of ['seb-btn-nav', 'seb-btn-confirm', 'seb-btn-tool', 'seb-btn-danger']) {
      if (cls !== desiredKind && button.classList.contains(cls)) button.classList.remove(cls);
    }
    if (!button.classList.contains('seb-action-btn')) button.classList.add('seb-action-btn');
    if (!button.classList.contains(desiredKind)) button.classList.add(desiredKind);
    const nextLabel = iconizedLabel(label);
    if (nextLabel && cleanText(button.textContent) !== nextLabel) button.textContent = nextLabel;
  }

  function normalizeButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button').forEach(normalizeButton);
  }

  function isPassButton(button) {
    const label = stripActionIcon(button.textContent).toLowerCase();
    return /^(passer|passez)\b/.test(label) || /^abandonner\b/.test(label) || /abandonner l['’]exercice/.test(label);
  }

  function headingLabel(scope, fallback) {
    if (!scope || !scope.querySelector) return fallback;
    const node = scope.querySelector('h1,h2');
    const value = cleanText(node && node.textContent);
    if (!value) return fallback;
    return value.length > 100 ? value.slice(0, 97) + '…' : value;
  }

  function visibleQcmPage() {
    const pages = Array.from(document.querySelectorAll('.page'));
    return pages.find((page) => page.classList.contains('visible')) || null;
  }

  function currentExerciseContext() {
    const file = pageName();
    if (file === 'qcmv1.0.html') {
      const scope = visibleQcmPage();
      if (!scope || !scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return null;
      const label = QCM_LABELS[scope.id] || headingLabel(scope, 'QCM — ' + scope.id);
      return { file, qcmPage: scope.id, scope, label, key: file + '#' + scope.id };
    }
    if (!EXERCISE_FILES.has(file)) return null;
    if (file === 'brique.html' || file === 'tri_de_cheville.html') {
      const auto = document.getElementById('autoEvalPart');
      if (auto) {
        let visible = auto.classList.contains('visible');
        try { visible = visible || window.getComputedStyle(auto).display !== 'none'; } catch (_) {}
        if (visible) return null;
      }
    }
    return {
      file,
      qcmPage: '',
      scope: document.body,
      label: EXERCISE_LABELS[file] || headingLabel(document.body, file),
      key: file
    };
  }

  function hideLegacyPassButtons() {
    const file = pageName();
    if (file === 'qcmv1.0.html') {
      document.querySelectorAll('.page').forEach((scope) => {
        if (!scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return;
        scope.querySelectorAll('button').forEach((button) => {
          if (!isPassButton(button)) return;
          button.dataset.sebLegacyPasser = '1';
          button.hidden = true;
          button.style.setProperty('display', 'none', 'important');
        });
      });
      return;
    }
    if (!EXERCISE_FILES.has(file)) return;
    document.querySelectorAll('button').forEach((button) => {
      if (!isPassButton(button) || button.id === 'seb-evalpro-abandon-fixed') return;
      button.dataset.sebLegacyPasser = '1';
      button.hidden = true;
      button.style.setProperty('display', 'none', 'important');
    });
  }


  function autoEvalHasResponse(form) {
    if (!form) return false;
    const checked = form.querySelector('input[type="checkbox"]:checked');
    const text = Array.from(form.querySelectorAll('textarea,input[type="text"]')).some((el) => String(el.value || '').trim() !== '');
    return !!checked || text;
  }

  function protectAutoEvaluations() {
    const form = document.getElementById('autoEvalForm');
    if (!form) return;
    const file = pageName();
    const standalone = file === 'autoeval1.html' || file === 'autoeval2.html';
    document.querySelectorAll('button').forEach((button) => {
      if (skipButton(button)) return;
      const inAuto = standalone || !!button.closest('#autoEvalPart');
      if (!inAuto) return;
      const label = stripActionIcon(button.textContent).toLowerCase();
      if (/^(passer|passez|étape suivante|etape suivante|page suivante|suivant)\b/.test(label)) {
        button.hidden = true;
        button.style.setProperty('display', 'none', 'important');
      }
    });

    if (document.documentElement.dataset.sebAutoEvalGuard === '1') return;
    document.documentElement.dataset.sebAutoEvalGuard = '1';
    document.addEventListener('click', function (event) {
      const button = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!button) return;
      const currentForm = document.getElementById('autoEvalForm');
      if (!currentForm) return;
      const currentFile = pageName();
      const inStandalone = currentFile === 'autoeval1.html' || currentFile === 'autoeval2.html';
      const inIntegrated = !!button.closest('#autoEvalPart');
      if (!inStandalone && !inIntegrated) return;
      const label = stripActionIcon(button.textContent).toLowerCase();
      const validatesAuto = button.id === 'autoEvalBtn' || (/valider/.test(label) && /autoévaluation|autoevaluation/.test(label));
      if (!validatesAuto) return;
      if (autoEvalHasResponse(currentForm)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');
    }, true);
  }

  function readAbandons() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(ABANDON_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveAbandon(context, reasons, comment) {
    const now = new Date();
    const record = {
      key: context.key,
      page: context.file,
      qcmPage: context.qcmPage || '',
      exercice: context.label,
      raisons: reasons.slice(),
      commentaire: String(comment || '').trim(),
      horodatage: now.toLocaleString('fr-FR'),
      iso: now.toISOString()
    };
    const list = readAbandons();
    const index = list.findIndex((item) => item && item.key === record.key);
    if (index >= 0) list[index] = record;
    else list.push(record);
    sessionStorage.setItem(ABANDON_KEY, JSON.stringify(list));
    if (window.sebEvalPro && typeof window.sebEvalPro.save === 'function') window.sebEvalPro.save();
    return record;
  }

  function withConfirmedNavigation(action) {
    const originalConfirm = window.confirm;
    try {
      window.confirm = function () { return true; };
      action();
    } finally {
      window.confirm = originalConfirm;
    }
  }

  function invokeQcmNext(context) {
    const legacy = context.scope.querySelector('button[data-seb-legacy-passer="1"]');
    if (legacy) {
      withConfirmedNavigation(function () { legacy.click(); });
      return true;
    }

    const candidates = Array.from(context.scope.querySelectorAll('button')).filter((button) => {
      if (button.id === 'seb-evalpro-abandon-fixed') return false;
      const value = stripActionIcon(button.textContent).toLowerCase();
      return /suivant|étape suivante|etape suivante|page suivante|continuer/.test(value);
    });

    for (const button of candidates) {
      const source = button.getAttribute('onclick') || '';
      const match = source.match(/nextPage\(\s*(['"]?)([^'"\)]+)\1\s*\)/);
      if (match && typeof window.nextPage === 'function') {
        const raw = String(match[2]).trim();
        const target = /^\d+$/.test(raw) ? Number(raw) : raw;
        window.nextPage(target);
        return true;
      }
      const go = source.match(/goToPage\(\s*['"]([^'"]+)['"]\s*\)/);
      if (go) {
        window.location.href = go[1];
        return true;
      }
    }

    if (candidates[0]) {
      withConfirmedNavigation(function () { candidates[0].click(); });
      return true;
    }
    return false;
  }

  function advanceAfterAbandon(context) {
    if (context.file === 'qcmv1.0.html') {
      if (!invokeQcmNext(context)) {
        window.alert('L’abandon a bien été enregistré. Utilisez le bouton Suivant pour poursuivre.');
      }
      return;
    }
    const target = NEXT_BY_FILE[context.file];
    if (target) {
      window.location.href = target;
      return;
    }
    window.alert('L’abandon a bien été enregistré. Utilisez le bouton Suivant pour poursuivre.');
  }

  function openAbandonDialog(context) {
    if (!context || document.getElementById('seb-evalpro-abandon-layer')) return;
    const layer = document.createElement('div');
    layer.id = 'seb-evalpro-abandon-layer';
    layer.innerHTML = `
      <div id="seb-evalpro-abandon-box" role="dialog" aria-modal="true" aria-label="Abandonner l’exercice">
        <h2>Abandonner l’exercice</h2>
        <div class="seb-abandon-exercise"></div>
        <p class="seb-abandon-help">Indiquez la ou les raisons de votre abandon. Au moins une proposition doit être cochée. L’abandon doit ensuite être validé par un administrateur.</p>
        <label class="seb-abandon-choice"><input type="checkbox" value="Je ne comprends pas la consigne"><span>Je ne comprends pas la consigne.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="L’exercice est trop difficile"><span>L’exercice est trop difficile.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="Fatigue, gêne ou douleur"><span>Je ressens de la fatigue, une gêne ou une douleur.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="Autre raison" data-other="1"><span>Autre raison.</span></label>
        <textarea id="seb-evalpro-abandon-comment" placeholder="Précisez si nécessaire. Si vous cochez « Autre raison », indiquez ici la raison."></textarea>
        <div class="seb-abandon-admin"><label for="seb-evalpro-abandon-admin-password">Validation administrateur</label><input id="seb-evalpro-abandon-admin-password" type="password" autocomplete="off" placeholder="Mot de passe administrateur"><small>L’administrateur doit valider l’abandon avant de poursuivre.</small></div>
        <div id="seb-evalpro-abandon-error" aria-live="polite"></div>
        <div id="seb-evalpro-abandon-actions">
          <button type="button" id="seb-evalpro-abandon-cancel" class="seb-action-btn seb-btn-nav">✕ Annuler</button>
          <button type="button" id="seb-evalpro-abandon-confirm" class="seb-action-btn seb-btn-danger">⏹ Confirmer l’abandon</button>
        </div>
      </div>`;
    layer.querySelector('.seb-abandon-exercise').textContent = context.label;
    document.body.appendChild(layer);

    const error = layer.querySelector('#seb-evalpro-abandon-error');
    const comment = layer.querySelector('#seb-evalpro-abandon-comment');
    const adminPassword = layer.querySelector('#seb-evalpro-abandon-admin-password');
    const close = function () { layer.remove(); };

    layer.querySelector('#seb-evalpro-abandon-cancel').addEventListener('click', close);
    layer.querySelector('#seb-evalpro-abandon-confirm').addEventListener('click', async function () {
      const checked = Array.from(layer.querySelectorAll('input[type="checkbox"]:checked'));
      if (checked.length === 0) {
        error.textContent = 'Cochez au moins une raison avant de confirmer.';
        return;
      }
      const otherChecked = checked.some((input) => input.dataset.other === '1');
      if (otherChecked && !comment.value.trim()) {
        error.textContent = 'Précisez la raison dans la zone de commentaire.';
        comment.focus();
        return;
      }
      const password = String(adminPassword?.value || '').trim();
      if (!password) {
        error.textContent = 'Le mot de passe administrateur est obligatoire pour valider l’abandon.';
        adminPassword?.focus();
        return;
      }
      let adminOk = false;
      try {
        adminOk = !!(window.sebEvalPro?.verifyAdminPassword && await window.sebEvalPro.verifyAdminPassword(password));
      } catch (_) {}
      if (!adminOk) {
        error.textContent = 'Mot de passe administrateur incorrect. L’exercice reste actif.';
        if (adminPassword) { adminPassword.value = ''; adminPassword.focus(); }
        return;
      }
      const reasons = checked.map((input) => input.value);
      if (context.file === 'tri_de_cheville.html') {
        try { if (typeof window.calcMoyenne === 'function') window.calcMoyenne(); } catch (_) {}
        try { if (typeof window.saveTriResultsToQCM === 'function') window.saveTriResultsToQCM(); } catch (_) {}
      }
      if (context.file === 'dictee.html') {
        try {
          let state = {};
          try { state = JSON.parse(sessionStorage.getItem('dictee_data') || '{}') || {}; } catch (_) {}
          state.status = 'abandoned';
          state.scoreSur20 = 0;
          state.abandonne = true;
          sessionStorage.setItem('dictee_data', JSON.stringify(state));
          if (window.sebEvalPro && typeof window.sebEvalPro.save === 'function') window.sebEvalPro.save();
        } catch (_) {}
      }
      saveAbandon(context, reasons, comment.value);
      close();
      setTimeout(function () { advanceAfterAbandon(context); }, 40);
    });

    layer.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  }

  function ensureAbandonButton() {
    let button = document.getElementById('seb-evalpro-abandon-fixed');
    if (!button) {
      button = document.createElement('button');
      button.id = 'seb-evalpro-abandon-fixed';
      button.type = 'button';
      button.className = 'seb-action-btn seb-btn-danger';
      button.textContent = '⏹ Abandonner l’exercice';
      button.addEventListener('click', function () {
        const context = currentExerciseContext();
        if (context) openAbandonDialog(context);
      });
      document.body.appendChild(button);
    }
    return button;
  }

  function refreshAbandonButton() {
    const button = ensureAbandonButton();
    const context = currentExerciseContext();
    if (context) {
      button.style.setProperty('display', 'inline-flex', 'important');
      button.title = 'Abandonner : ' + context.label;
    } else {
      button.style.setProperty('display', 'none', 'important');
      button.title = '';
    }
  }

  function renderAdminAbandons() {
    if (pageName() !== 'admin-bilan.html') return;
    const tbody = document.querySelector('#bilan tbody');
    if (!tbody) return;
    tbody.querySelectorAll('.seb-admin-abandon-section,.seb-admin-abandon-row').forEach((node) => node.remove());
    const list = readAbandons();
    if (!list.length) return;

    const section = document.createElement('tr');
    section.className = 'section2 seb-admin-abandon-section';
    const sectionCell = document.createElement('td');
    sectionCell.colSpan = 6;
    sectionCell.textContent = 'Exercices abandonnés par le stagiaire';
    section.appendChild(sectionCell);
    tbody.appendChild(section);

    list.forEach((record) => {
      const row = document.createElement('tr');
      row.className = 'seb-admin-abandon-row';

      const exerciseCell = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = record.exercice || record.page || 'Exercice';
      exerciseCell.appendChild(strong);

      const stateCell = document.createElement('td');
      stateCell.colSpan = 4;
      stateCell.className = 'seb-admin-abandon-state';
      stateCell.textContent = 'EXERCICE ABANDONNÉ';

      const commentCell = document.createElement('td');
      commentCell.className = 'seb-admin-abandon-comment';
      const reasons = Array.isArray(record.raisons) ? record.raisons.join(' ; ') : '';
      let details = 'Motif(s) : ' + (reasons || 'Non renseigné');
      if (record.commentaire) details += '\nCommentaire : ' + record.commentaire;
      if (record.horodatage) details += '\nEnregistré le : ' + record.horodatage;
      details += '\nLes données déjà saisies avant l’abandon ont été conservées.';
      commentCell.textContent = details;

      row.appendChild(exerciseCell);
      row.appendChild(stateCell);
      row.appendChild(commentCell);
      tbody.appendChild(row);
    });
  }

  function refreshAll() {
    ensureStyles();
    normalizeButtons(document);
    hideLegacyPassButtons();
    protectAutoEvaluations();
    refreshAbandonButton();
    renderAdminAbandons();
  }

  function scheduleRefresh() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    setTimeout(function () {
      mutationScheduled = false;
      refreshAll();
    }, 0);
  }

  function init() {
    refreshAll();
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


// SEB_EXERCISE_NAVIGATION_GUARD98
(function(){
  'use strict';

  const TRUE_FILES = new Set([
    'brique.html','stock.html','planning.html','genrenombres.html',
    'tri_de_cheville.html','nwtexte.html','nvmail.html','paronymes.html','carre.html'
  ]);
  const QCM_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);
  let scheduled = false;

  function fileName(){
    try { return decodeURIComponent((window.location.pathname.split('/').pop() || '').toLowerCase()); }
    catch (_) { return ''; }
  }

  function clean(value){
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^(?:➡️|➡|➜|→|←|✓|✔|▶️|▶|⏹️|⏹|■|📊|🧮|💾|✉️|✉)\s*/u, '')
      .replace(/\s*(?:->|→|➜)\s*$/u, '')
      .trim();
  }

  function visibleQcmExercise(){
    const page = Array.from(document.querySelectorAll('.page')).find(function(node){ return node.classList.contains('visible'); });
    return page && QCM_IDS.has(page.id) ? page : null;
  }

  function context(){
    const file = fileName();
    if (file === 'qcmv1.0.html') {
      const scope = visibleQcmExercise();
      return scope ? { file:file, scope:scope, key:file + '#' + scope.id } : null;
    }
    if (!TRUE_FILES.has(file)) return null;
    return { file:file, scope:document.body, key:file };
  }

  function activityKey(ctx){ return 'seb_exercise_activity:' + ctx.key; }
  function hasActivityFlag(ctx){ return sessionStorage.getItem(activityKey(ctx)) === '1'; }
  function setActivity(ctx){
    if (!ctx) return;
    sessionStorage.setItem(activityKey(ctx), '1');
  }

  function hasMeaningfulValues(scope){
    if (!scope || !scope.querySelectorAll) return false;
    if (scope.querySelector('input[type="checkbox"]:checked,input[type="radio"]:checked,.item.selected,[aria-pressed="true"]')) return true;

    const fields = Array.from(scope.querySelectorAll('input,textarea,select'));
    for (const field of fields) {
      const type = String(field.type || '').toLowerCase();
      if (['hidden','button','submit','reset','file','checkbox','radio'].includes(type)) continue;
      if (field.tagName === 'SELECT') {
        const value = String(field.value == null ? '' : field.value).trim();
        if (field.selectedIndex > 0 && value !== '' && value !== '_') return true;
        continue;
      }
      if (String(field.value == null ? '' : field.value).trim() !== '') return true;
    }

    const editable = Array.from(scope.querySelectorAll('[contenteditable="true"],.ql-editor'));
    if (editable.some(function(node){
      const text = String(node.innerText || node.textContent || '').replace(/\u200B/g, '').trim();
      return text !== '' || !!node.querySelector('img');
    })) return true;

    const file = fileName();
    if (file === 'stock.html' && scope.querySelector('.case .pot,#zone-tri .pot,.etagere .pot')) return true;
    return false;
  }

  function storageExists(key){ return sessionStorage.getItem(key) !== null; }

  function ready(ctx){
    if (!ctx) return true;

    if (!hasActivityFlag(ctx) && hasMeaningfulValues(ctx.scope)) setActivity(ctx);
    const activity = hasActivityFlag(ctx);

    if (ctx.file === 'tri_de_cheville.html') {
      if (typeof window.sebEvalProTriNavigationReady === 'function') return !!window.sebEvalProTriNavigationReady();
      return sessionStorage.getItem('seb_tri_navigation_ready') === '1';
    }
    if (ctx.file === 'brique.html') return activity && storageExists('eval_brique') && storageExists('eval_brique_auto');
    if (ctx.file === 'stock.html') return activity && storageExists('stockTotal');
    if (ctx.file === 'planning.html') return activity && storageExists('planningScore');
    if (ctx.file === 'genrenombres.html') return activity && storageExists('erreurs_exercice');
    if (ctx.file === 'nvmail.html') return activity && storageExists('page8_data');
    if (ctx.file === 'paronymes.html') return activity && storageExists('paronymes_score');
    if (ctx.file === 'carre.html') return activity && storageExists('carre_magique_score');
    if (ctx.file === 'nwtexte.html') return activity;

    // Pages d'exercices QCM : le bouton Suivant n'est pas disponible tant
    // qu'aucune réponse / sélection n'a été effectuée sur la page visible.
    if (ctx.file === 'qcmv1.0.html') return activity;
    return activity;
  }

  function isNavigationButton(button){
    if (!button || button.id === 'seb-evalpro-abandon-fixed') return false;
    if (button.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer')) return false;
    const label = clean(button.textContent).toLowerCase();
    return /^(suivant|page suivante|étape suivante|etape suivante|continuer)\b/.test(label);
  }

  function belongsToContext(button, ctx){
    if (!ctx) return false;
    if (ctx.file === 'qcmv1.0.html') return ctx.scope.contains(button);
    return document.body.contains(button);
  }

  function ensureStyle(){
    if (document.getElementById('seb-exercise-navigation-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-exercise-navigation-guard-style';
    style.textContent = 'button.seb-exercise-nav-locked{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  function enforce(){
    scheduled = false;
    ensureStyle();
    const ctx = context();
    if (!ctx) {
      document.querySelectorAll('.seb-exercise-nav-locked').forEach(function(button){ button.classList.remove('seb-exercise-nav-locked'); });
      return;
    }
    const unlocked = ready(ctx);
    document.querySelectorAll('button').forEach(function(button){
      if (!isNavigationButton(button) || !belongsToContext(button, ctx)) return;
      button.classList.toggle('seb-exercise-nav-locked', !unlocked);
      button.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
      if (!unlocked) button.tabIndex = -1;
      else if (button.tabIndex < 0) button.removeAttribute('tabindex');
    });
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enforce);
  }

  function markFromEvent(event){
    const ctx = context();
    if (!ctx) return;
    const target = event.target;
    if (!target || (ctx.file === 'qcmv1.0.html' && !ctx.scope.contains(target))) return;

    if (event.type === 'input' || event.type === 'change' || event.type === 'drop' || event.type === 'dragstart') {
      setActivity(ctx);
      schedule();
      return;
    }

    if (event.type === 'click') {
      const interactive = target.closest && target.closest('.item,[aria-pressed],td:not(.paronyme),.pot,.case,[contenteditable="true"],.fake-file-input');
      if (interactive) {
        setActivity(ctx);
        schedule();
        return;
      }
      const button = target.closest && target.closest('button');
      if (button) {
        const label = clean(button.textContent).toLowerCase();
        if (/^(démarrer|demarrer)\b/.test(label)) {
          setActivity(ctx);
          schedule();
        }
      }
    }
  }

  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || !isNavigationButton(button)) return;
    const ctx = context();
    if (!ctx || !belongsToContext(button, ctx) || ready(ctx)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    window.alert(ctx.file === 'tri_de_cheville.html'
      ? 'Terminez au moins 3 tris puis validez l’autoévaluation avant de passer à l’étape suivante.'
      : 'Vous devez réaliser l’exercice avant de passer à l’étape suivante. Si vous souhaitez arrêter cet exercice, utilisez « Abandonner l’exercice ».');
  }, true);

  ['input','change','click','drop','dragstart'].forEach(function(type){
    document.addEventListener(type, markFromEvent, true);
  });

  function init(){
    ensureStyle();
    enforce();
    new MutationObserver(schedule).observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-pressed']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
