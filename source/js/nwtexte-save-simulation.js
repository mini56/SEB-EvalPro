(function () {
  'use strict';

  const STORAGE_KEY = 'nwtexte_save_simulation';
  let simulatedPath = null;

  function readCandidateName() {
    try {
      const data = JSON.parse(sessionStorage.getItem('candidat_data') || '{}');
      return String(data.nom || data.Nom || '').trim();
    } catch (_) {
      return '';
    }
  }

  function cleanFilename(value) {
    return String(value || '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\.(html?|docx?|txt)$/i, '')
      .trim();
  }

  function expectedFilename() {
    const nom = readCandidateName();
    return (nom || 'Nom') + '_Evaluation_Bureautique_SEB';
  }

  function ensureStyles() {
    if (document.getElementById('seb-fake-save-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-fake-save-style';
    style.textContent = `
      #seb-fake-save-backdrop{position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-family:"Segoe UI",Arial,sans-serif;color:#202020}
      #seb-fake-save-window{width:min(780px,calc(100vw - 40px));height:min(520px,calc(100vh - 40px));background:#fff;border:1px solid #8a8a8a;box-shadow:0 12px 38px rgba(0,0,0,.35);display:flex;flex-direction:column;border-radius:3px;overflow:hidden}
      #seb-fake-save-titlebar{height:38px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #d6d6d6;background:#f7f7f7;font-size:14px}
      #seb-fake-save-titlebar .title{flex:1;font-weight:600}
      #seb-fake-save-close{border:0;background:transparent;font-size:22px;line-height:1;width:38px;height:38px;cursor:pointer;color:#333}
      #seb-fake-save-close:hover{background:#e81123;color:#fff}
      #seb-fake-save-address{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #ddd;background:#fff}
      #seb-fake-save-back{width:32px;height:30px;border:1px solid #c8c8c8;background:#f7f7f7;border-radius:2px;cursor:pointer;font-size:18px}
      #seb-fake-save-back:disabled{opacity:.4;cursor:default}
      #seb-fake-save-addressbox{flex:1;border:1px solid #b8b8b8;height:30px;display:flex;align-items:center;padding:0 10px;font-size:13px;background:#fff}
      #seb-fake-save-body{flex:1;display:flex;min-height:0}
      #seb-fake-save-nav{width:170px;background:#fafafa;border-right:1px solid #ddd;padding:8px 0;box-sizing:border-box}
      .seb-fake-navitem{padding:8px 14px;font-size:13px;display:flex;gap:8px;align-items:center}
      .seb-fake-navitem.active{background:#e5f3ff}
      #seb-fake-save-files{flex:1;padding:18px;display:flex;align-content:flex-start;align-items:flex-start;gap:18px;flex-wrap:wrap;overflow:auto;background:#fff}
      .seb-fake-folder{width:92px;min-height:86px;border:1px solid transparent;border-radius:2px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:default;user-select:none;font-size:13px;text-align:center}
      .seb-fake-folder:hover,.seb-fake-folder.selected{background:#e5f3ff;border-color:#99d1ff}
      .seb-fake-folder-icon{font-size:43px;line-height:1}
      #seb-fake-save-footer{border-top:1px solid #ddd;padding:12px 14px;background:#f7f7f7;display:grid;grid-template-columns:110px 1fr auto auto;gap:9px;align-items:center;font-size:13px}
      #seb-fake-save-name{height:30px;border:1px solid #999;padding:3px 8px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;box-sizing:border-box}
      #seb-fake-save-button,#seb-fake-cancel-button{height:32px;min-width:92px;border:1px solid #8a8a8a;background:#f4f4f4;padding:0 14px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;cursor:pointer}
      #seb-fake-save-button{border-color:#0078d4;background:#e5f3ff}
      #seb-fake-save-button:hover{background:#cce8ff}
      #seb-fake-cancel-button:hover{background:#e5e5e5}
      #seb-fake-save-hint{grid-column:2 / -1;min-height:18px;color:#b00020;font-size:12px}
      #seb-fake-save-toast{position:fixed;right:24px;bottom:24px;z-index:2147483641;background:#222;color:#fff;padding:10px 15px;border-radius:4px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    ensureStyles();
    document.getElementById('seb-fake-save-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'seb-fake-save-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function persistSimulation(filename) {
    const clean = cleanFilename(filename);
    const fullName = clean + '.html';
    const expected = expectedFilename();
    const state = {
      dossier: 'Bureau\\SEB',
      nom: clean,
      fichier: fullName,
      nomAttendu: expected,
      nomConforme: clean.toLocaleLowerCase('fr') === expected.toLocaleLowerCase('fr'),
      enregistre: true,
      date: new Date().toISOString()
    };

    localStorage.setItem('dernierFichierTexte', clean);
    localStorage.setItem('dernierEnregistrementSous', 'true');
    localStorage.setItem('dernierEnregistrement', 'true');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    simulatedPath = state;

    try {
      if (typeof window.sauvegarderContenuEditeur === 'function') window.sauvegarderContenuEditeur();
    } catch (error) {
      console.warn('SEB EvalPro nwtexte: sauvegarde interne après simulation impossible.', error);
    }
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    return state;
  }

  function restoreSimulationState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && value.enregistre && value.nom) simulatedPath = value;
    } catch (_) {}
  }

  function openSaveDialog() {
    ensureStyles();
    document.getElementById('seb-fake-save-backdrop')?.remove();

    let location = 'desktop';
    let folderSelected = false;
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-fake-save-backdrop';
    backdrop.innerHTML = `
      <div id="seb-fake-save-window" role="dialog" aria-modal="true" aria-label="Enregistrer sous">
        <div id="seb-fake-save-titlebar"><span class="title">Enregistrer sous</span><button id="seb-fake-save-close" type="button" aria-label="Fermer">×</button></div>
        <div id="seb-fake-save-address">
          <button id="seb-fake-save-back" type="button" disabled title="Retour">←</button>
          <div id="seb-fake-save-addressbox">Ce PC &gt; Bureau</div>
        </div>
        <div id="seb-fake-save-body">
          <div id="seb-fake-save-nav">
            <div class="seb-fake-navitem">🖥️ Ce PC</div>
            <div class="seb-fake-navitem active">🖼️ Bureau</div>
            <div class="seb-fake-navitem">📄 Documents</div>
            <div class="seb-fake-navitem">⬇️ Téléchargements</div>
          </div>
          <div id="seb-fake-save-files"></div>
        </div>
        <div id="seb-fake-save-footer">
          <label for="seb-fake-save-name">Nom du fichier :</label>
          <input id="seb-fake-save-name" type="text" autocomplete="off" spellcheck="false" />
          <button id="seb-fake-save-button" type="button">Enregistrer</button>
          <button id="seb-fake-cancel-button" type="button">Annuler</button>
          <div id="seb-fake-save-hint"></div>
        </div>
      </div>`;

    document.body.appendChild(backdrop);

    const files = backdrop.querySelector('#seb-fake-save-files');
    const address = backdrop.querySelector('#seb-fake-save-addressbox');
    const back = backdrop.querySelector('#seb-fake-save-back');
    const nameInput = backdrop.querySelector('#seb-fake-save-name');
    const hint = backdrop.querySelector('#seb-fake-save-hint');

    function close() {
      backdrop.remove();
    }

    function render() {
      hint.textContent = '';
      folderSelected = false;
      if (location === 'desktop') {
        address.textContent = 'Ce PC > Bureau';
        back.disabled = true;
        files.innerHTML = '<div class="seb-fake-folder" id="seb-fake-folder-seb" tabindex="0"><div class="seb-fake-folder-icon">📁</div><div>SEB</div></div>';
        const folder = files.querySelector('#seb-fake-folder-seb');
        folder.addEventListener('click', function () {
          files.querySelectorAll('.seb-fake-folder').forEach((item) => item.classList.remove('selected'));
          folder.classList.add('selected');
          folderSelected = true;
        });
        folder.addEventListener('dblclick', enterSeb);
        folder.addEventListener('keydown', function (event) {
          if (event.key === 'Enter') enterSeb();
        });
      } else {
        address.textContent = 'Ce PC > Bureau > SEB';
        back.disabled = false;
        files.innerHTML = '';
        nameInput.focus();
      }
    }

    function enterSeb() {
      location = 'seb';
      render();
    }

    function save() {
      if (location !== 'seb') {
        if (folderSelected) {
          enterSeb();
          return;
        }
        hint.textContent = 'Ouvrez le dossier SEB avant d’enregistrer le document.';
        return;
      }
      const name = cleanFilename(nameInput.value);
      if (!name) {
        hint.textContent = 'Saisissez le nom du fichier demandé dans la consigne.';
        nameInput.focus();
        return;
      }
      const state = persistSimulation(name);
      close();
      showToast('Document enregistré dans Bureau\\SEB\\' + state.fichier);
    }

    backdrop.querySelector('#seb-fake-save-close').addEventListener('click', close);
    backdrop.querySelector('#seb-fake-cancel-button').addEventListener('click', close);
    backdrop.querySelector('#seb-fake-save-button').addEventListener('click', save);
    back.addEventListener('click', function () {
      location = 'desktop';
      render();
    });
    nameInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') close();
    });
    backdrop.addEventListener('mousedown', function (event) {
      if (event.target === backdrop) event.preventDefault();
    });

    render();
  }

  function saveCurrentOrOpenDialog() {
    restoreSimulationState();
    if (!simulatedPath) {
      openSaveDialog();
      return;
    }
    persistSimulation(simulatedPath.nom);
    showToast('Document enregistré dans Bureau\\SEB\\' + simulatedPath.fichier);
  }

  restoreSimulationState();
  window.enregistrerFichier = saveCurrentOrOpenDialog;
  window.enregistrerSousFichier = openSaveDialog;
})();
