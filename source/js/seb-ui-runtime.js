(function () {
  'use strict';

  const ABANDON_KEY = 'seb_evalpro_abandons';
  const EXERCISE_FILES = new Set([
    'brique.html',
    'stock.html',
    'planning.html',
    'genrenombres.html',
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
    'genrenombres.html': 'tri_de_cheville.html',
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
      '#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer'
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
    button.classList.remove('seb-btn-nav', 'seb-btn-confirm', 'seb-btn-tool', 'seb-btn-danger');
    button.classList.add('seb-action-btn', 'seb-btn-' + kind);
    const nextLabel = iconizedLabel(label);
    if (nextLabel && cleanText(button.textContent) !== nextLabel) button.textContent = nextLabel;
  }

  function normalizeButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button').forEach(normalizeButton);
  }

  function isPassButton(button) {
    const label = stripActionIcon(button.textContent).toLowerCase();
    return /^(passer|passez)\b/.test(label) || /abandonner l['’]exercice/.test(label);
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
      if (!scope || !scope.id || QCM_EXCLUDED.has(scope.id)) return null;
      const label = QCM_LABELS[scope.id] || headingLabel(scope, 'QCM — ' + scope.id);
      return { file, qcmPage: scope.id, scope, label, key: file + '#' + scope.id };
    }
    if (!EXERCISE_FILES.has(file)) return null;
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
        if (!scope.id || QCM_EXCLUDED.has(scope.id)) return;
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
        <p class="seb-abandon-help">Indiquez la ou les raisons de votre abandon. Au moins une proposition doit être cochée.</p>
        <label class="seb-abandon-choice"><input type="checkbox" value="Je ne comprends pas la consigne"><span>Je ne comprends pas la consigne.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="L’exercice est trop difficile"><span>L’exercice est trop difficile.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="Fatigue, gêne ou douleur"><span>Je ressens de la fatigue, une gêne ou une douleur.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" value="Autre raison" data-other="1"><span>Autre raison.</span></label>
        <textarea id="seb-evalpro-abandon-comment" placeholder="Précisez si nécessaire. Si vous cochez « Autre raison », indiquez ici la raison."></textarea>
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
    const close = function () { layer.remove(); };

    layer.querySelector('#seb-evalpro-abandon-cancel').addEventListener('click', close);
    layer.querySelector('#seb-evalpro-abandon-confirm').addEventListener('click', function () {
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
      const reasons = checked.map((input) => input.value);
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
    button.style.display = context ? 'inline-flex' : 'none';
    if (context) button.title = 'Abandonner : ' + context.label;
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
