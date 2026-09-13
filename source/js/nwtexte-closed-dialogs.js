(function () {
  'use strict';

  const SAVE_KEY = 'nwtexte_save_simulation';
  const STYLE_ID = 'seb-nwtexte-closed-dialogs-style';
  const BACKDROP_ID = 'seb-nwtexte-picker-backdrop';
  const TOAST_ID = 'seb-nwtexte-picker-toast';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BACKDROP_ID}{position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.30);display:flex;align-items:center;justify-content:center;font-family:"Segoe UI",Arial,sans-serif;color:#202020}
      #seb-nwtexte-picker-window{width:min(820px,calc(100vw - 42px));height:min(535px,calc(100vh - 42px));background:#fff;border:1px solid #8a8a8a;box-shadow:0 12px 38px rgba(0,0,0,.38);display:flex;flex-direction:column;border-radius:3px;overflow:hidden}
      #seb-nwtexte-picker-titlebar{height:40px;display:flex;align-items:center;padding:0 0 0 13px;border-bottom:1px solid #d5d5d5;background:#f7f7f7;font-size:14px;user-select:none}
      #seb-nwtexte-picker-titlebar .title{flex:1;font-weight:600}
      #seb-nwtexte-picker-close{border:0;background:transparent;font-size:22px;line-height:1;width:46px;height:40px;cursor:pointer;color:#333}
      #seb-nwtexte-picker-close:hover{background:#e81123;color:#fff}
      #seb-nwtexte-picker-tools{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #ddd;background:#fff}
      #seb-nwtexte-picker-back{width:34px;height:30px;border:1px solid #c8c8c8;background:#f7f7f7;border-radius:2px;font-size:18px;color:#555;cursor:default}
      #seb-nwtexte-picker-address{flex:1;border:1px solid #b8b8b8;height:30px;display:flex;align-items:center;padding:0 10px;font-size:13px;background:#fff}
      #seb-nwtexte-picker-search{width:185px;border:1px solid #b8b8b8;height:30px;padding:0 9px;box-sizing:border-box;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;background:#fff}
      #seb-nwtexte-picker-body{flex:1;display:flex;min-height:0}
      #seb-nwtexte-picker-nav{width:185px;background:#fafafa;border-right:1px solid #ddd;padding:8px 0;box-sizing:border-box;user-select:none}
      .seb-nwtexte-picker-navitem{padding:8px 14px;font-size:13px;display:flex;gap:8px;align-items:center}
      .seb-nwtexte-picker-navitem.active{background:#e5f3ff}
      #seb-nwtexte-picker-files{flex:1;padding:16px;overflow:auto;background:#fff;display:flex;align-content:flex-start;align-items:flex-start;gap:13px;flex-wrap:wrap}
      .seb-nwtexte-picker-file{width:126px;min-height:104px;border:1px solid transparent;border-radius:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:6px;box-sizing:border-box;cursor:default;user-select:none;font-size:12px;text-align:center;word-break:break-word}
      .seb-nwtexte-picker-file:hover,.seb-nwtexte-picker-file.selected{background:#e5f3ff;border-color:#99d1ff}
      .seb-nwtexte-picker-icon{font-size:46px;line-height:1}
      #seb-nwtexte-picker-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#666;font-size:13px;text-align:center}
      #seb-nwtexte-picker-footer{border-top:1px solid #ddd;padding:11px 14px;background:#f7f7f7;display:grid;grid-template-columns:110px 1fr auto auto;gap:9px;align-items:center;font-size:13px}
      #seb-nwtexte-picker-name{height:30px;border:1px solid #999;padding:3px 8px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;box-sizing:border-box;background:#fff}
      #seb-nwtexte-picker-primary,#seb-nwtexte-picker-cancel{height:32px;min-width:92px;border:1px solid #8a8a8a;background:#f4f4f4;padding:0 14px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;cursor:pointer}
      #seb-nwtexte-picker-primary{border-color:#0078d4;background:#e5f3ff}
      #seb-nwtexte-picker-primary:hover:not(:disabled){background:#cce8ff}
      #seb-nwtexte-picker-primary:disabled{opacity:.45;cursor:default}
      #seb-nwtexte-picker-cancel:hover{background:#e5e5e5}
      #seb-nwtexte-picker-hint{grid-column:2 / -1;min-height:18px;color:#555;font-size:12px}
      #${TOAST_ID}{position:fixed;right:24px;bottom:24px;z-index:2147483646;background:#222;color:#fff;padding:10px 15px;border-radius:4px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    ensureStyles();
    document.getElementById(TOAST_ID)?.remove();
    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function readSavedDocument() {
    try {
      const state = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (state && state.enregistre && state.fichier) return state;
    } catch (_) {}
    return null;
  }

  function candidateFilename() {
    try {
      const candidate = JSON.parse(sessionStorage.getItem('candidat_data') || '{}');
      const name = String(candidate.nom || candidate.Nom || 'Nom').trim() || 'Nom';
      return name + '_Evaluation_Bureautique_SEB.html';
    } catch (_) {
      return 'Nom_Evaluation_Bureautique_SEB.html';
    }
  }

  function closeDialog() {
    document.getElementById(BACKDROP_ID)?.remove();
  }

  function createFileItem(name, icon, value) {
    const file = document.createElement('div');
    file.className = 'seb-nwtexte-picker-file';
    file.tabIndex = 0;
    file.dataset.value = value || name;
    file.dataset.name = name;
    file.innerHTML = `<div class="seb-nwtexte-picker-icon">${icon}</div><div>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
    return file;
  }

  function openDialog(kind) {
    ensureStyles();
    closeDialog();

    const isImage = kind === 'image';
    const saved = readSavedDocument();
    const title = isImage ? 'Insérer une image' : 'Ouvrir';
    const address = isImage ? 'Ce PC > Images' : 'Ce PC > Bureau > SEB';
    const primaryText = isImage ? 'Insérer' : 'Ouvrir';
    const backdrop = document.createElement('div');
    backdrop.id = BACKDROP_ID;
    backdrop.innerHTML = `
      <div id="seb-nwtexte-picker-window" role="dialog" aria-modal="true" aria-label="${title}">
        <div id="seb-nwtexte-picker-titlebar"><span class="title">${title}</span><button id="seb-nwtexte-picker-close" type="button" aria-label="Fermer">×</button></div>
        <div id="seb-nwtexte-picker-tools">
          <button id="seb-nwtexte-picker-back" type="button" title="Retour">←</button>
          <div id="seb-nwtexte-picker-address">${address}</div>
          <input id="seb-nwtexte-picker-search" type="text" placeholder="Rechercher" autocomplete="off" spellcheck="false" />
        </div>
        <div id="seb-nwtexte-picker-body">
          <div id="seb-nwtexte-picker-nav">
            <div class="seb-nwtexte-picker-navitem">⭐ Accès rapide</div>
            <div class="seb-nwtexte-picker-navitem">🖥️ Ce PC</div>
            <div class="seb-nwtexte-picker-navitem ${isImage ? '' : 'active'}">🖼️ Bureau</div>
            <div class="seb-nwtexte-picker-navitem">📄 Documents</div>
            <div class="seb-nwtexte-picker-navitem ${isImage ? 'active' : ''}">🌄 Images</div>
            <div class="seb-nwtexte-picker-navitem">📁 SEB</div>
          </div>
          <div id="seb-nwtexte-picker-files"></div>
        </div>
        <div id="seb-nwtexte-picker-footer">
          <label for="seb-nwtexte-picker-name">Nom du fichier :</label>
          <input id="seb-nwtexte-picker-name" type="text" readonly />
          <button id="seb-nwtexte-picker-primary" type="button" disabled>${primaryText}</button>
          <button id="seb-nwtexte-picker-cancel" type="button">Annuler</button>
          <div id="seb-nwtexte-picker-hint">Fenêtre simulée dans SEB EvalPro — aucun accès à Windows.</div>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    const files = backdrop.querySelector('#seb-nwtexte-picker-files');
    const name = backdrop.querySelector('#seb-nwtexte-picker-name');
    const primary = backdrop.querySelector('#seb-nwtexte-picker-primary');
    const search = backdrop.querySelector('#seb-nwtexte-picker-search');
    let selected = null;

    const items = [];
    if (isImage) {
      items.push(createFileItem('Photo_01.jpg', '🖼️', 'Photo_01.jpg'));
      items.push(createFileItem('Image_02.png', '🌄', 'Image_02.png'));
      items.push(createFileItem('Illustration.png', '🏞️', 'Illustration.png'));
    } else if (saved) {
      items.push(createFileItem(saved.fichier, '📄', saved.fichier));
    }

    function select(item) {
      items.forEach((candidate) => candidate.classList.remove('selected'));
      item.classList.add('selected');
      selected = item.dataset.value;
      name.value = item.dataset.name;
      primary.disabled = false;
    }

    function render(filter) {
      files.innerHTML = '';
      const text = String(filter || '').trim().toLowerCase();
      const visible = items.filter((item) => !text || item.dataset.name.toLowerCase().includes(text));
      if (!visible.length) {
        const empty = document.createElement('div');
        empty.id = 'seb-nwtexte-picker-empty';
        empty.textContent = isImage
          ? 'Aucune autre image n’est disponible dans cette fenêtre simulée.'
          : (saved ? 'Aucun fichier ne correspond à la recherche.' : 'Ce dossier est vide. Enregistrez d’abord le document dans le dossier SEB.');
        files.appendChild(empty);
        primary.disabled = true;
        name.value = '';
        selected = null;
        return;
      }
      visible.forEach((item) => {
        files.appendChild(item);
        item.onclick = () => select(item);
        item.ondblclick = () => {
          select(item);
          confirmSelection();
        };
        item.onkeydown = (event) => {
          if (event.key === 'Enter') {
            select(item);
            confirmSelection();
          }
        };
      });
    }

    function confirmSelection() {
      if (!selected) return;
      closeDialog();
      if (isImage) {
        showToast('Image sélectionnée dans la fenêtre simulée.');
      } else {
        showToast('Document ouvert dans la fenêtre simulée : ' + selected);
      }
    }

    backdrop.querySelector('#seb-nwtexte-picker-close').onclick = closeDialog;
    backdrop.querySelector('#seb-nwtexte-picker-cancel').onclick = closeDialog;
    backdrop.querySelector('#seb-nwtexte-picker-primary').onclick = confirmSelection;
    backdrop.querySelector('#seb-nwtexte-picker-back').onclick = function () {
      showToast('Navigation Windows désactivée dans cet exercice.');
    };
    search.addEventListener('input', () => render(search.value));
    backdrop.addEventListener('mousedown', function (event) {
      if (event.target === backdrop) event.preventDefault();
    });
    document.addEventListener('keydown', function escapeHandler(event) {
      if (event.key !== 'Escape') return;
      document.removeEventListener('keydown', escapeHandler, true);
      closeDialog();
    }, true);

    if (!isImage && !saved) name.placeholder = candidateFilename();
    render('');
    setTimeout(() => search.focus(), 0);
  }

  function blockNativeFileAccess() {
    document.querySelectorAll('input[type="file"]').forEach((input) => input.remove());

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (target && target.matches && target.matches('input[type="file"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener('dragover', function (event) {
      if (event.dataTransfer && event.dataTransfer.types && Array.from(event.dataTransfer.types).includes('Files')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'none';
      }
    }, true);

    document.addEventListener('drop', function (event) {
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast('Import de fichiers Windows désactivé dans cet exercice.');
      }
    }, true);

    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'o') {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDialog('open');
      }
    }, true);

    try {
      if ('showOpenFilePicker' in window) window.showOpenFilePicker = async function () { throw new Error('Accès fichiers Windows désactivé dans nwtexte.'); };
    } catch (_) {}
    try {
      if ('showSaveFilePicker' in window) window.showSaveFilePicker = async function () { throw new Error('Accès fichiers Windows désactivé dans nwtexte.'); };
    } catch (_) {}
  }

  window.ouvrirFichierFictif = function () { openDialog('open'); };
  window.ouvrirImageFictive = function () { openDialog('image'); };

  // Garde-fous : même un ancien appel résiduel ne peut plus ouvrir Windows.
  window.ouvrirFichier = function () { openDialog('open'); };
  window.insererImage = function () { openDialog('image'); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blockNativeFileAccess, { once: true });
  } else {
    blockNativeFileAccess();
  }
})();
