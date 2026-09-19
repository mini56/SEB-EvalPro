const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const BAR_HEIGHT = 44;
const HOTZONE_HEIGHT = 5;
const BAR_HIDE_DELAY = 450;
let restoredState = {};
let adminUnlocked = false;
let saveTimer = null;
let periodicSaveTimer = null;
let barHideTimer = null;
let closingSession = false;
let lastSaveErrorShown = '';

function objectToStorage(storage, values) {
  if (!storage || !values || typeof values !== 'object') return;
  for (const [key, value] of Object.entries(values)) {
    try {
      storage.setItem(key, String(value));
    } catch (_) {}
  }
}

function storageToObject(storage) {
  const out = {};
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      out[key] = storage.getItem(key);
    }
  } catch (_) {}
  return out;
}

function pageName() {
  try {
    return path.basename(decodeURIComponent(window.location.pathname)) || 'qcmv1.0.html';
  } catch (_) {
    return 'qcmv1.0.html';
  }
}

function isAdminBilanPage(page = pageName()) {
  return ['admin-bilan.html', 'bilan.html'].includes(String(page || '').toLowerCase());
}

function buildSnapshot() {
  const page = pageName();
  return {
    ...restoredState,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: page,
    lastEvaluationPage: isAdminBilanPage(page)
      ? (restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page
  };
}

function handleSaveResult(result) {
  if (!result || result.ok !== false || !result.error) return;
  const message = String(result.error);
  if (message === lastSaveErrorShown) return;
  lastSaveErrorShown = message;
  if (document && document.body) {
    showTransferMessage(
      'Attention — sauvegarde',
      message + '\n\nLes données déjà enregistrées restent conservées. Vérifiez le support de stockage avant de poursuivre.',
      true
    ).catch(() => {});
  }
}

function saveNow(sync = false) {
  if (closingSession) return;
  const snapshot = buildSnapshot();
  restoredState = snapshot;
  if (sync) {
    const result = ipcRenderer.sendSync('state:save-sync', snapshot);
    handleSaveResult(result);
  } else {
    ipcRenderer.invoke('state:save', snapshot).then(handleSaveResult).catch((error) => {
      handleSaveResult({ ok:false, error:String(error && error.message ? error.message : error) });
    });
  }
}

function scheduleSave() {
  if (closingSession) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(false), 250);
}

function createPasswordDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-admin-dialog';
    backdrop.innerHTML = `
      <div class="seb-admin-card" role="dialog" aria-modal="true" aria-label="Accès administrateur">
        <div class="seb-admin-title">Accès administrateur</div>
        <label class="seb-admin-label" for="seb-admin-password">Mot de passe</label>
        <input id="seb-admin-password" class="seb-admin-input" type="password" autocomplete="off" />
        <div id="seb-admin-error" class="seb-admin-error" aria-live="polite"></div>
        <div class="seb-admin-actions">
          <button type="button" id="seb-admin-cancel">Annuler</button>
          <button type="button" id="seb-admin-ok" class="primary">Valider</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-admin-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-admin-dialog .seb-admin-card{width:360px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.28);box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:16px}
      #seb-evalpro-admin-dialog .seb-admin-label{display:block;font-size:14px;margin-bottom:6px;color:#222}
      #seb-evalpro-admin-dialog .seb-admin-input{width:100%;font-size:18px;padding:8px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-admin-dialog .seb-admin-error{min-height:20px;color:#c00000;font-size:13px;margin-top:6px}
      #seb-evalpro-admin-dialog .seb-admin-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #seb-evalpro-admin-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-admin-dialog button.primary{background:#0070c0;color:#fff;border-color:#0070c0}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#seb-admin-password');
    const error = backdrop.querySelector('#seb-admin-error');
    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-admin-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-admin-ok').addEventListener('click', async () => {
      const ok = await ipcRenderer.invoke('admin:verify', input.value);
      input.value = '';
      if (ok) finish(true);
      else {
        error.textContent = 'Mot de passe incorrect.';
        input.focus();
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') backdrop.querySelector('#seb-admin-ok').click();
      if (event.key === 'Escape') finish(false);
    });
    input.focus();
  });
}

function createSessionCloseDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-session-close-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Fermer cette session">
        <div class="seb-session-close-title">Fermer cette session ?</div>
        <div class="seb-session-close-text">
          L'évaluation active sera fermée.
          Au prochain démarrage, SEB EvalPro commencera sur une nouvelle évaluation vierge.
        </div>
        <div class="seb-session-close-warning">Le dossier du candidat et les données déjà sauvegardées seront conservés dans Documents\\SEB EvalPro\\Candidats.</div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-session-close-cancel">Annuler</button>
          <button type="button" id="seb-session-close-ok" class="danger">Fermer cette session</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-session-close-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-session-close-dialog .seb-session-close-card{width:430px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-session-close-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-session-close-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-session-close-dialog .seb-session-close-warning{font-size:13px;font-weight:700;color:#c00000;margin-top:10px}
      #seb-evalpro-session-close-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-session-close-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-session-close-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };

    backdrop.querySelector('#seb-session-close-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-session-close-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-session-close-cancel').focus();
  });
}


function createTransferNameDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true" aria-label="Nom du regroupement">
        <div class="seb-transfer-title">Importer les dossiers candidats</div>
        <div class="seb-transfer-text">Choisissez le nom du dossier qui regroupera les stagiaires sur le PC Admin.</div>
        <label class="seb-transfer-label" for="seb-transfer-name">Nom du dossier</label>
        <input id="seb-transfer-name" class="seb-transfer-input" type="text" autocomplete="off" placeholder="Ex. Lorient, Groupe A, Session septembre" />
        <div id="seb-transfer-error" class="seb-transfer-error" aria-live="polite"></div>
        <div class="seb-transfer-actions">
          <button type="button" id="seb-transfer-cancel">Annuler</button>
          <button type="button" id="seb-transfer-ok">Continuer</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-dialog .seb-transfer-card{width:470px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:10px}
      #seb-evalpro-transfer-dialog .seb-transfer-text{font-size:14px;line-height:1.45;color:#222;margin-bottom:14px}
      #seb-evalpro-transfer-dialog .seb-transfer-label{display:block;font-size:14px;font-weight:700;color:#222;margin-bottom:6px}
      #seb-evalpro-transfer-dialog .seb-transfer-input{width:100%;font-size:17px;padding:9px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-error{min-height:20px;color:#c00000;font-size:13px;margin-top:6px}
      #seb-evalpro-transfer-dialog .seb-transfer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
      #seb-evalpro-transfer-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#seb-transfer-name');
    const error = backdrop.querySelector('#seb-transfer-error');
    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    const accept = () => {
      const value = String(input.value || '').trim();
      if (!value) {
        error.textContent = 'Saisissez un nom de dossier.';
        input.focus();
        return;
      }
      finish(value);
    };

    backdrop.querySelector('#seb-transfer-cancel').addEventListener('click', () => finish(null));
    backdrop.querySelector('#seb-transfer-ok').addEventListener('click', accept);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') accept();
      if (event.key === 'Escape') finish(null);
    });
    input.focus();
  });
}

function showTransferMessage(title, message, isError = false) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true">
        <div class="seb-transfer-title"></div>
        <div class="seb-transfer-message"></div>
        <div class="seb-transfer-actions">
          <button type="button" id="seb-transfer-ok">OK</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-dialog .seb-transfer-card{width:520px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:12px}
      #seb-evalpro-transfer-dialog .seb-transfer-message{font-size:14px;line-height:1.5;color:#222;white-space:pre-wrap;overflow-wrap:anywhere}
      #seb-evalpro-transfer-dialog .seb-transfer-actions{display:flex;justify-content:flex-end;margin-top:18px}
      #seb-evalpro-transfer-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 18px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
    `;
    backdrop.appendChild(style);
    const titleNode = backdrop.querySelector('.seb-transfer-title');
    titleNode.textContent = String(title || '');
    if (isError) titleNode.style.color = '#c00000';
    backdrop.querySelector('.seb-transfer-message').textContent = String(message || '');
    document.body.appendChild(backdrop);

    const finish = () => {
      backdrop.remove();
      resolve();
    };
    backdrop.querySelector('#seb-transfer-ok').addEventListener('click', finish);
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') finish();
    });
    backdrop.querySelector('#seb-transfer-ok').focus();
  });
}

function injectAdminBar() {
  if (!document.body || document.getElementById('seb-evalpro-topbar')) return;

  const bar = document.createElement('div');
  bar.id = 'seb-evalpro-topbar';
  bar.innerHTML = `
    <div class="seb-evalpro-name">SEB EvalPro</div>
    <div id="seb-evalpro-candidate-badge" class="seb-evalpro-candidate-badge" hidden></div>
    <div class="seb-evalpro-spacer"></div>
    <button id="seb-evalpro-return" type="button" hidden>Retour à l'évaluation</button>
    <button id="seb-evalpro-bilan" type="button" hidden>Bilan</button>
    <button id="seb-evalpro-export-candidates" type="button" hidden>Exporter dossiers</button>
    <button id="seb-evalpro-import-candidates" type="button" hidden>Importer dossiers</button>
    <button id="seb-evalpro-close-session" type="button" hidden>Fermer cette session</button>
    <button id="seb-evalpro-admin" type="button">Administrateur</button>`;

  const hotzone = document.createElement('div');
  hotzone.id = 'seb-evalpro-top-hotzone';
  hotzone.setAttribute('aria-hidden', 'true');

  const style = document.createElement('style');
  style.id = 'seb-evalpro-shell-style';
  style.textContent = `
    html{box-sizing:border-box}
    body{padding-top:0 !important;box-sizing:border-box}
    #seb-evalpro-top-hotzone{position:fixed;top:0;left:0;right:0;height:${HOTZONE_HEIGHT}px;z-index:2147483645;background:transparent}
    #seb-evalpro-topbar{position:fixed;top:0;left:0;right:0;height:${BAR_HEIGHT}px;z-index:2147483646;display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;background:#0070c0;color:#fff;font-family:Arial,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);transform:translateY(-100%);transition:transform .16s ease;will-change:transform}
    #seb-evalpro-topbar.seb-evalpro-visible{transform:translateY(0)}
    #seb-evalpro-topbar .seb-evalpro-name{font-size:18px;font-weight:700;white-space:nowrap}
    #seb-evalpro-topbar .seb-evalpro-candidate-badge{font-size:13px;font-weight:700;white-space:nowrap;padding:5px 9px;border:1px solid rgba(255,255,255,.55);border-radius:4px;background:rgba(255,255,255,.14)}
    #seb-evalpro-topbar .seb-evalpro-spacer{flex:1}
    #seb-evalpro-topbar button{font-family:Arial,sans-serif;font-size:14px;padding:6px 12px;border:1px solid rgba(255,255,255,.75);border-radius:4px;background:#fff;color:#0070c0;cursor:pointer}
    #seb-evalpro-topbar button:hover{background:#f2f2f2}
    #seb-evalpro-topbar #seb-evalpro-close-session{background:#c00000;color:#fff;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-close-session:hover{background:#a00000}
  `;
  document.head.appendChild(style);
  document.body.prepend(bar);
  document.body.prepend(hotzone);

  const adminButton = bar.querySelector('#seb-evalpro-admin');
  const candidateBadge = bar.querySelector('#seb-evalpro-candidate-badge');
  const bilanButton = bar.querySelector('#seb-evalpro-bilan');
  const returnButton = bar.querySelector('#seb-evalpro-return');
  const exportCandidatesButton = bar.querySelector('#seb-evalpro-export-candidates');
  const importCandidatesButton = bar.querySelector('#seb-evalpro-import-candidates');
  const closeSessionButton = bar.querySelector('#seb-evalpro-close-session');

  const showBar = () => {
    clearTimeout(barHideTimer);
    bar.classList.add('seb-evalpro-visible');
  };

  const hideBar = () => {
    if (document.getElementById('seb-evalpro-admin-dialog')) return;
    if (document.getElementById('seb-evalpro-session-close-dialog')) return;
    if (document.getElementById('seb-evalpro-transfer-dialog')) return;
    bar.classList.remove('seb-evalpro-visible');
  };

  const scheduleHideBar = () => {
    clearTimeout(barHideTimer);
    barHideTimer = setTimeout(() => {
      if (!bar.matches(':hover') && !hotzone.matches(':hover')) hideBar();
    }, BAR_HIDE_DELAY);
  };

  hotzone.addEventListener('mouseenter', showBar);
  hotzone.addEventListener('mouseleave', scheduleHideBar);
  bar.addEventListener('mouseenter', showBar);
  bar.addEventListener('mouseleave', scheduleHideBar);
  document.addEventListener('mousemove', (event) => {
    if (event.clientY <= 2) showBar();
  }, true);

  const refreshCandidateBadge = async () => {
    if (!candidateBadge) return;
    if (!adminUnlocked) {
      candidateBadge.hidden = true;
      candidateBadge.textContent = '';
      return;
    }
    try {
      const active = await ipcRenderer.invoke('candidate:active');
      if (active && active.displayName) {
        candidateBadge.textContent = `Dossier candidat : ${active.displayName}`;
        candidateBadge.hidden = false;
      } else {
        candidateBadge.textContent = 'Dossier candidat : aucun';
        candidateBadge.hidden = false;
      }
    } catch (_) {
      candidateBadge.hidden = true;
    }
  };

  const updateAdminButtons = () => {
    const onBilan = isAdminBilanPage();
    bilanButton.hidden = !adminUnlocked || onBilan;
    returnButton.hidden = !adminUnlocked || !onBilan;
    exportCandidatesButton.hidden = !adminUnlocked;
    importCandidatesButton.hidden = !adminUnlocked;
    closeSessionButton.hidden = !adminUnlocked;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
    refreshCandidateBadge();
  };

  adminButton.addEventListener('click', async () => {
    showBar();

    if (adminUnlocked) {
      await ipcRenderer.invoke('admin:lock');
      adminUnlocked = false;
      updateAdminButtons();
      scheduleHideBar();
      return;
    }

    const ok = await createPasswordDialog();
    if (ok) {
      adminUnlocked = true;
      updateAdminButtons();
    }
    scheduleHideBar();
  });

  bilanButton.addEventListener('click', async () => {
    saveNow(true);
    await ipcRenderer.invoke('admin:open-bilan');
  });

  returnButton.addEventListener('click', async () => {
    saveNow(true);
    await ipcRenderer.invoke('admin:return-evaluation');
  });

  exportCandidatesButton.addEventListener('click', async () => {
    showBar();
    saveNow(true);
    exportCandidatesButton.disabled = true;
    importCandidatesButton.disabled = true;
    try {
      const result = await ipcRenderer.invoke('admin:export-candidates');
      if (!result || result.cancelled) return;
      if (!result.ok) {
        await showTransferMessage('Export impossible', result.error || 'Une erreur est survenue pendant l’export.', true);
        return;
      }
      if (!result.total) {
        await showTransferMessage('Export candidats', 'Aucun dossier candidat n’a été trouvé sur ce PC.');
        return;
      }
      await showTransferMessage(
        'Export terminé',
        `Copie des fichiers terminée.\nVous pouvez retirer la clé USB en toute sécurité.\n\n${result.added} dossier(s) copié(s), ${result.skipped || 0} déjà présent(s) et ignoré(s).\n${result.verifiedFiles || 0} fichier(s) vérifié(s).\n\nClé : ${result.destinationRoot}`
      );
    } catch (error) {
      await showTransferMessage('Export impossible', String(error && error.message ? error.message : error), true);
    } finally {
      exportCandidatesButton.disabled = false;
      importCandidatesButton.disabled = false;
      scheduleHideBar();
    }
  });

  importCandidatesButton.addEventListener('click', async () => {
    showBar();
    exportCandidatesButton.disabled = true;
    importCandidatesButton.disabled = true;
    try {
      const result = await ipcRenderer.invoke('admin:import-candidates');
      if (!result || result.cancelled) return;
      if (!result.ok) {
        await showTransferMessage('Import impossible', result.error || 'Une erreur est survenue pendant l’import.', true);
        return;
      }
      if (!result.total) {
        await showTransferMessage('Import candidats', 'Aucun dossier candidat valide n’a été trouvé sur la clé sélectionnée.');
        return;
      }
      await showTransferMessage(
        'Import terminé',
        `${result.total} dossier(s) candidat(s) détecté(s).\n${result.added} ajouté(s), ${result.skipped || 0} déjà présent(s) et ignoré(s).\n${result.verifiedFiles || 0} fichier(s) vérifié(s).\n\nDossier SEB EvalPro : ${result.destinationRoot}`
      );
    } catch (error) {
      await showTransferMessage('Import impossible', String(error && error.message ? error.message : error), true);
    } finally {
      exportCandidatesButton.disabled = false;
      importCandidatesButton.disabled = false;
      scheduleHideBar();
    }
  });

  closeSessionButton.addEventListener('click', async () => {
    showBar();
    const confirmed = await createSessionCloseDialog();
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    saveNow(true);
    closingSession = true;
    clearTimeout(saveTimer);
    if (periodicSaveTimer) clearInterval(periodicSaveTimer);

    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
    } catch (_) {}

    await ipcRenderer.invoke('admin:close-session').catch(() => false);
  });

  updateAdminButtons();
  hideBar();
}

try {
  restoredState = ipcRenderer.sendSync('state:load-sync') || {};
  objectToStorage(window.sessionStorage, restoredState.sessionStorage);
  objectToStorage(window.localStorage, restoredState.localStorage);
} catch (_) {}

window.addEventListener('DOMContentLoaded', async () => {
  adminUnlocked = await ipcRenderer.invoke('admin:status');
  injectAdminBar();
  document.addEventListener('input', scheduleSave, true);
  document.addEventListener('change', scheduleSave, true);
  document.addEventListener('click', scheduleSave, true);
  periodicSaveTimer = setInterval(() => saveNow(false), 1000);
});

window.addEventListener('beforeunload', () => {
  if (!closingSession) saveNow(true);
});

contextBridge.exposeInMainWorld('sebEvalPro', {
  save: () => saveNow(false),
  verifyAdminPassword: (password) => ipcRenderer.invoke('admin:verify-password', password),
  localAiStatus: () => ipcRenderer.invoke('ai:status'),
  rewriteSynthesisLocal: (text) => ipcRenderer.invoke('ai:rewrite-synthesis', String(text || ''))
});