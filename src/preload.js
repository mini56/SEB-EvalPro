const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const replayPrototype = require('./replay-preload');
const replayNavigationCapture = require('./replay-navigation-capture');
const bilanHistory = require('./bilan-history-preload');
const candidateCatalog = require('./candidate-catalog-preload');
// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD
const editionCapabilities = ipcRenderer.sendSync('app:edition-sync') || {
  edition:'admin', canBilan:true, canAi:true, canImport:true, canExport:true
};

const BAR_HEIGHT = 44;
// SEB_PRIORITY_FIXES_PRELOAD
const HOTZONE_HEIGHT = 5;
const BAR_HIDE_DELAY = 1000;
const SAVE_DEBOUNCE_MS = 750;
const SAVE_CHECKPOINT_MS = 5000;
let restoredState = {};
let adminUnlocked = false;
let saveTimer = null;
let periodicSaveTimer = null;
let saveDirty = true;
let saveInFlight = null;
let saveAfterFlight = false;
let lastSavedFingerprint = '';
let barHideTimer = null;
let closingSession = false;
let lastSaveErrorShown = '';
let adminCandidateWorkspace = null;
let adminCandidateResultsWorkspace = null;
let adminNavigationLeaving = false;
let candidateJourneyCompleted = false;
let candidateCompletionInFlight = false;

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

function isAdminCandidatesPage(page = pageName()) {
  return String(page || '').toLowerCase() === 'admin-candidats.html';
}

function isAdminNavigationPage(page = pageName()) {
  return isAdminBilanPage(page) || isAdminCandidatesPage(page);
}

function buildSnapshot() {
  const page = pageName();
  return {
    ...restoredState,
    sessionStorage: storageToObject(window.sessionStorage),
    localStorage: storageToObject(window.localStorage),
    lastPage: isAdminNavigationPage(page)
      ? (restoredState.lastPage || restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page,
    lastEvaluationPage: isAdminNavigationPage(page)
      ? (restoredState.lastEvaluationPage || 'qcmv1.0.html')
      : page
  };
}

function snapshotFingerprint(snapshot) {
  try {
    return JSON.stringify({
      sessionStorage: snapshot && snapshot.sessionStorage || {},
      localStorage: snapshot && snapshot.localStorage || {},
      lastPage: snapshot && snapshot.lastPage || '',
      lastEvaluationPage: snapshot && snapshot.lastEvaluationPage || ''
    });
  } catch (_) {
    return '';
  }
}

function handleSaveResult(result) {
  if (!result || result.ok !== false) {
    lastSaveErrorShown = '';
    return;
  }
  if (!result.error) return;
  const message = String(result.error);
  if (message === lastSaveErrorShown) return;
  lastSaveErrorShown = message;
  if (document && document.body) {
    showTransferMessage(
      'Attention — sauvegarde',
      message + '\n\nLes données déjà enregistrées restent conservées. SEB EvalPro réessaiera automatiquement.',
      true
    ).catch(() => {});
  }
}

function saveNow(sync = false) {
  if (candidateJourneyCompleted) return sync ? { ok:true, completed:true } : Promise.resolve({ ok:true, completed:true });
  if (closingSession || adminNavigationLeaving) return null;
  if (isAdminCandidatesPage()) {
    const adminResult = { ok:true, adminNavigation:true };
    return sync ? adminResult : Promise.resolve(adminResult);
  }
  if (adminCandidateResultsWorkspace) {
    const readOnlyResult = { ok:true, readOnly:true };
    return sync ? readOnlyResult : Promise.resolve(readOnlyResult);
  }

  const snapshot = buildSnapshot();
  const fingerprint = snapshotFingerprint(snapshot);
  restoredState = snapshot;
  const candidateWorkspace = !!adminCandidateWorkspace && isAdminBilanPage();

  if (sync) {
    clearTimeout(saveTimer);
    const result = candidateWorkspace
      ? ipcRenderer.sendSync('candidate-catalog:workspace-save-sync', snapshot)
      : ipcRenderer.sendSync('state:save-sync', snapshot);
    if (result && result.ok !== false) {
      lastSavedFingerprint = fingerprint;
      saveDirty = false;
      saveAfterFlight = false;
    } else {
      saveDirty = true;
    }
    handleSaveResult(result);
    return result;
  }

  if (!saveDirty && fingerprint && fingerprint === lastSavedFingerprint) {
    return Promise.resolve({ ok:true, unchanged:true });
  }

  if (saveInFlight) {
    saveDirty = true;
    saveAfterFlight = true;
    return saveInFlight;
  }

  saveDirty = false;
  saveAfterFlight = false;
  const request = candidateWorkspace
    ? ipcRenderer.invoke('candidate-catalog:workspace-save', snapshot)
    : ipcRenderer.invoke('state:save', snapshot);

  const current = request.then((result) => {
    if (result && result.ok !== false) lastSavedFingerprint = fingerprint;
    else saveDirty = true;
    handleSaveResult(result);
    return result;
  }).catch((error) => {
    const result = { ok:false, error:String(error && error.message ? error.message : error) };
    saveDirty = true;
    handleSaveResult(result);
    return result;
  });

  saveInFlight = current;
  current.then(() => {
    if (saveInFlight === current) saveInFlight = null;
    if (saveDirty || saveAfterFlight) {
      saveAfterFlight = false;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveNow(false), SAVE_DEBOUNCE_MS);
    }
  });
  return current;
}

function scheduleSave() {
  if (closingSession || adminNavigationLeaving || isAdminCandidatesPage() || adminCandidateResultsWorkspace) return;
  saveDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(false), SAVE_DEBOUNCE_MS);
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
          SEB EvalPro va quitter proprement après vérification des sauvegardes en cours.
          Si un parcours candidat n'est pas terminé, il restera reprenable au prochain démarrage.
        </div>
        <div class="seb-session-close-warning">Cette action ne termine pas le parcours du candidat.</div>
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


function createCandidateFinishDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-finish-candidate-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Terminer le parcours du candidat">
        <div class="seb-session-close-title">Terminer définitivement le parcours en cours ?</div>
        <div class="seb-session-close-text">
          Le candidat ne pourra plus reprendre son évaluation sur ce PC.
          Les réponses déjà enregistrées seront conservées et le dossier deviendra exportable.
        </div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-finish-candidate-cancel">Annuler</button>
          <button type="button" id="seb-finish-candidate-ok" class="danger">Terminer le parcours</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-finish-candidate-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-card{width:460px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-finish-candidate-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-finish-candidate-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-finish-candidate-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-finish-candidate-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-finish-candidate-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-finish-candidate-cancel').focus();
  });
}


function createExportCandidateFinishDialog(activeCandidate) {
  return new Promise((resolve) => {
    const rawName = String(activeCandidate && activeCandidate.displayName || 'ce candidat').trim() || 'ce candidat';
    const safeName = rawName.replace(/[&<>"']/g, (char) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    })[char]);

    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-export-finish-candidate-dialog';
    backdrop.innerHTML = `
      <div class="seb-session-close-card" role="dialog" aria-modal="true" aria-label="Terminer le parcours avant export">
        <div class="seb-session-close-title">Parcours candidat encore en cours</div>
        <div class="seb-session-close-text">
          Le parcours de <strong>${safeName}</strong> est encore en cours.<br><br>
          Voulez-vous mettre fin au parcours de <strong>${safeName}</strong> avant l’export ?
        </div>
        <div class="seb-session-close-warning">
          Cette action est définitive : le parcours ne pourra plus être repris.
        </div>
        <div class="seb-session-close-actions">
          <button type="button" id="seb-export-finish-cancel">Annuler l’export</button>
          <button type="button" id="seb-export-finish-ok" class="danger">Terminer le parcours et exporter</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-export-finish-candidate-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-card{width:500px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-title{font-size:20px;font-weight:700;color:#c00000;margin-bottom:12px}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-text{font-size:14px;line-height:1.45;color:#222}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-warning{font-size:13px;font-weight:700;color:#c00000;margin-top:10px}
      #seb-evalpro-export-finish-candidate-dialog .seb-session-close-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      #seb-evalpro-export-finish-candidate-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:1px solid #999;border-radius:4px;background:#f2f2f2;cursor:pointer}
      #seb-evalpro-export-finish-candidate-dialog button.danger{background:#c00000;color:#fff;border-color:#c00000}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-export-finish-cancel').addEventListener('click', () => finish(false));
    backdrop.querySelector('#seb-export-finish-ok').addEventListener('click', () => finish(true));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    backdrop.querySelector('#seb-export-finish-cancel').focus();
  });
}


function createExportDestinationModeDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-export-destination-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true" aria-label="Destination de l’export">
        <div class="seb-transfer-title">Où exporter les candidats ?</div>
        <div class="seb-transfer-text">
          Vous pouvez ajouter les fichiers à un dossier déjà présent sur la clé USB,
          ou créer un nouveau dossier pour cette série d’exports.
        </div>
        <div class="seb-transfer-actions export-choice">
          <button type="button" id="seb-export-existing">Choisir un dossier existant</button>
          <button type="button" id="seb-export-create">Créer un nouveau dossier</button>
          <button type="button" id="seb-export-cancel">Annuler</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-export-destination-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-export-destination-dialog .seb-transfer-card{width:520px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-export-destination-dialog .seb-transfer-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:10px}
      #seb-evalpro-export-destination-dialog .seb-transfer-text{font-size:14px;line-height:1.45;color:#222;margin-bottom:16px}
      #seb-evalpro-export-destination-dialog .seb-transfer-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
      #seb-evalpro-export-destination-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:9px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
      #seb-evalpro-export-destination-dialog #seb-export-create{background:#0070c0;color:#fff}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const finish = (value) => {
      backdrop.remove();
      resolve(value);
    };
    backdrop.querySelector('#seb-export-existing').addEventListener('click', () => finish('existing'));
    backdrop.querySelector('#seb-export-create').addEventListener('click', () => finish('create'));
    backdrop.querySelector('#seb-export-cancel').addEventListener('click', () => finish(null));
    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(null);
    });
    backdrop.querySelector('#seb-export-existing').focus();
  });
}


function createTransferNameDialog() {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-card" role="dialog" aria-modal="true" aria-label="Nom du regroupement">
        <div class="seb-transfer-title">Créer un dossier d’export</div>
        <div class="seb-transfer-text">Saisissez le nom du nouveau dossier à créer sur la clé USB.</div>
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

function createTransferPasswordDialog(mode) {
  const isExport = mode === 'export';
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.id = 'seb-evalpro-transfer-password-dialog';
    backdrop.innerHTML = `
      <div class="seb-transfer-password-card" role="dialog" aria-modal="true" aria-label="${isExport ? 'Mot de passe export USB' : 'Mot de passe import USB'}">
        <div class="seb-transfer-password-title">${isExport ? 'Export USB sécurisé' : 'Import USB sécurisé'}</div>
        <div class="seb-transfer-password-text">${isExport
          ? 'Choisissez le mot de passe qui protégera les fichiers transférés. Il sera demandé sur l’autre PC.'
          : 'Saisissez le mot de passe utilisé lors de l’export de cette clé USB.'}</div>
        <label for="seb-transfer-password">Mot de passe de transfert</label>
        <input id="seb-transfer-password" type="password" autocomplete="off" />
        ${isExport ? `
          <label for="seb-transfer-password-confirm">Confirmer le mot de passe</label>
          <input id="seb-transfer-password-confirm" type="password" autocomplete="off" />
        ` : ''}
        <button type="button" id="seb-transfer-password-show" class="show-password">Afficher le mot de passe</button>
        <div id="seb-transfer-password-error" class="seb-transfer-password-error" aria-live="polite"></div>
        <div class="seb-transfer-password-actions">
          <button type="button" id="seb-transfer-password-cancel">Annuler</button>
          <button type="button" id="seb-transfer-password-ok" class="primary">${isExport ? 'Continuer l’export' : 'Continuer l’import'}</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #seb-evalpro-transfer-password-dialog{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-card{width:470px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #aaa;border-radius:8px;padding:20px;box-shadow:0 10px 35px rgba(0,0,0,.3);box-sizing:border-box}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-title{font-size:20px;font-weight:700;color:#0070c0;margin-bottom:8px}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-text{font-size:14px;line-height:1.45;color:#333;margin-bottom:14px}
      #seb-evalpro-transfer-password-dialog label{display:block;font-size:14px;font-weight:700;color:#222;margin:10px 0 5px}
      #seb-evalpro-transfer-password-dialog input{width:100%;font-size:18px;padding:8px 10px;border:1px solid #999;border-radius:4px;box-sizing:border-box}
      #seb-evalpro-transfer-password-dialog button{font-family:Arial,sans-serif;font-size:14px;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font-weight:700;cursor:pointer}
      #seb-evalpro-transfer-password-dialog button.show-password{margin-top:10px;padding:5px 10px;font-size:13px}
      #seb-evalpro-transfer-password-dialog button.primary{background:#0070c0;color:#fff}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-error{min-height:20px;color:#c00000;font-size:13px;margin-top:7px}
      #seb-evalpro-transfer-password-dialog .seb-transfer-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
    `;
    backdrop.appendChild(style);
    document.body.appendChild(backdrop);

    const password = backdrop.querySelector('#seb-transfer-password');
    const confirmation = backdrop.querySelector('#seb-transfer-password-confirm');
    const error = backdrop.querySelector('#seb-transfer-password-error');
    const show = backdrop.querySelector('#seb-transfer-password-show');
    let visible = false;

    const finish = (value) => {
      password.value = '';
      if (confirmation) confirmation.value = '';
      backdrop.remove();
      resolve(value);
    };

    show.addEventListener('click', () => {
      visible = !visible;
      password.type = visible ? 'text' : 'password';
      if (confirmation) confirmation.type = visible ? 'text' : 'password';
      show.textContent = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';
      password.focus();
    });

    const accept = () => {
      const value = String(password.value || '');
      if (value.length < 8) {
        error.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
        password.focus();
        return;
      }
      if (confirmation && value !== String(confirmation.value || '')) {
        error.textContent = 'Les deux mots de passe ne sont pas identiques.';
        confirmation.focus();
        return;
      }
      finish(value);
    };

    backdrop.querySelector('#seb-transfer-password-cancel').addEventListener('click', () => finish(null));
    backdrop.querySelector('#seb-transfer-password-ok').addEventListener('click', accept);
    for (const input of [password, confirmation].filter(Boolean)) {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') accept();
        if (event.key === 'Escape') finish(null);
      });
    }
    password.focus();
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


// SEB_ADMIN_STATE_SYNC_AFTER_EARLY_BAR
function sebSyncAdminBarState() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return;
  const adminButton = document.getElementById('seb-evalpro-admin');
  const bilanButton = document.getElementById('seb-evalpro-bilan');
  const returnButton = document.getElementById('seb-evalpro-return');
  const exportCandidatesButton = document.getElementById('seb-evalpro-export-candidates');
  const importCandidatesButton = document.getElementById('seb-evalpro-import-candidates');
  const closeSessionButton = document.getElementById('seb-evalpro-close-session');
  const onBilan = isAdminBilanPage();
  const onCandidateResults = !!adminCandidateResultsWorkspace;
  const onAdminDetail = onBilan || onCandidateResults;
  if (adminButton) {
    adminButton.hidden = false;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
  }
  if (bilanButton) bilanButton.hidden = true;
  if (returnButton) {
    returnButton.hidden = !adminUnlocked || !onAdminDetail;
    returnButton.textContent = 'Retour au candidat';
  }
  if (exportCandidatesButton) exportCandidatesButton.hidden = !adminUnlocked;
  if (importCandidatesButton) importCandidatesButton.hidden = !adminUnlocked;
  if (closeSessionButton) closeSessionButton.hidden = !adminUnlocked;
}

function injectAdminBar() {
  if (!document.body || document.getElementById('seb-evalpro-topbar')) return;

  const bar = document.createElement('div');
  bar.id = 'seb-evalpro-topbar';
  bar.innerHTML = `
    <div class="seb-evalpro-name">SEB EvalPro</div>
    <div id="seb-evalpro-build" class="seb-evalpro-build">Build #6</div>
    <div id="seb-evalpro-candidate-badge" class="seb-evalpro-candidate-badge" hidden></div>
    <div class="seb-evalpro-spacer"></div>
    <button id="seb-evalpro-return" type="button" hidden>Retour à l'évaluation</button>
    <button id="seb-evalpro-bilan" type="button" hidden>Bilan</button>
    <button id="seb-evalpro-export-candidates" type="button" hidden>Exporter dossiers</button>
    <button id="seb-evalpro-import-candidates" type="button" hidden>Importer dossiers</button>
    <button id="seb-evalpro-finish-candidate" type="button" hidden>Terminer le parcours du candidat</button>
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
    #seb-evalpro-topbar .seb-evalpro-build{font-size:12px;font-weight:700;white-space:nowrap;opacity:.9;padding:3px 7px;border:1px solid rgba(255,255,255,.55);border-radius:10px}
    #seb-evalpro-topbar .seb-evalpro-candidate-badge{font-size:13px;font-weight:700;white-space:nowrap;padding:5px 9px;border:1px solid rgba(255,255,255,.55);border-radius:4px;background:rgba(255,255,255,.14)}
    #seb-evalpro-topbar .seb-evalpro-spacer{flex:1}
    #seb-evalpro-topbar button{font-family:Arial,sans-serif;font-size:14px;font-weight:400;padding:6px 12px;border:1px solid rgba(255,255,255,.75);border-radius:4px;background:#fff;color:#0070c0;cursor:pointer}
    #seb-evalpro-topbar button:hover{background:#f2f2f2}
    #seb-evalpro-topbar #seb-evalpro-finish-candidate{background:#fff4e5;color:#8a4b00;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-close-session{background:#c00000;color:#fff;border-color:#fff}
    #seb-evalpro-topbar #seb-evalpro-close-session:hover{background:#a00000}
    /* SEB_ADMIN_BUTTON_POLISH */
    #seb-evalpro-topbar button,
    #seb-evalpro-admin-dialog button,
    #seb-evalpro-session-close-dialog button,
    #seb-evalpro-transfer-dialog button,
    #seb-evalpro-results-dialog button,
    #seb-replay-chooser button,
    #seb-replay-viewer button,
    #seb-bilan-history-chooser button,
    #seb-bilan-history-editor button{
      background:#fff!important;color:#0070c0!important;border:2px solid #0070c0!important;border-radius:6px!important;
      box-shadow:0 2px 5px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.95)!important;
      font-weight:700!important;cursor:pointer;transition:background .12s ease,box-shadow .12s ease,transform .12s ease
    }
    /* La barre Admin reste volontairement plus légère que les boutons de dialogue. */
    #seb-evalpro-topbar button{font-weight:400!important}
    #seb-evalpro-topbar button:hover,
    #seb-evalpro-admin-dialog button:hover,
    #seb-evalpro-session-close-dialog button:hover,
    #seb-evalpro-transfer-dialog button:hover,
    #seb-evalpro-results-dialog button:hover,
    #seb-replay-chooser button:hover,
    #seb-replay-viewer button:hover,
    #seb-bilan-history-chooser button:hover,
    #seb-bilan-history-editor button:hover{
      background:#f5f9fd!important;box-shadow:0 3px 7px rgba(0,0,0,.22),inset 0 1px 0 #fff!important;transform:translateY(-1px)
    }
    #seb-evalpro-topbar button:active,
    #seb-evalpro-admin-dialog button:active,
    #seb-evalpro-session-close-dialog button:active,
    #seb-evalpro-transfer-dialog button:active,
    #seb-evalpro-results-dialog button:active,
    #seb-replay-chooser button:active,
    #seb-replay-viewer button:active,
    #seb-bilan-history-chooser button:active,
    #seb-bilan-history-editor button:active{transform:translateY(0);box-shadow:inset 0 1px 3px rgba(0,0,0,.20)!important}
    #seb-evalpro-topbar #seb-evalpro-close-session,
    #seb-evalpro-session-close-dialog button.danger,
    #seb-bilan-history-chooser button.danger,
    #seb-bilan-history-editor button.danger{
      background:#fff!important;color:#c00000!important;border-color:#c00000!important
    }
    #seb-evalpro-topbar #seb-evalpro-close-session:hover,
    #seb-evalpro-session-close-dialog button.danger:hover,
    #seb-bilan-history-chooser button.danger:hover,
    #seb-bilan-history-editor button.danger:hover{background:#fff4f4!important}
    #seb-evalpro-topbar button:disabled,
    #seb-evalpro-admin-dialog button:disabled,
    #seb-evalpro-session-close-dialog button:disabled,
    #seb-evalpro-transfer-dialog button:disabled,
    #seb-evalpro-results-dialog button:disabled,
    #seb-replay-chooser button:disabled,
    #seb-replay-viewer button:disabled,
    #seb-bilan-history-chooser button:disabled,
    #seb-bilan-history-editor button:disabled{opacity:.48!important;transform:none!important;cursor:default!important}

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
  const finishCandidateButton = bar.querySelector('#seb-evalpro-finish-candidate');
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
      if (adminCandidateWorkspace && adminCandidateWorkspace.candidate) {
        const selected = adminCandidateWorkspace.candidate;
        const selectedName = [selected.prenom || selected['prénom'], selected.nom].filter(Boolean).join(' ').trim();
        candidateBadge.textContent = 'Bilan candidat : ' + (selectedName || 'candidat sélectionné');
        candidateBadge.hidden = false;
        return;
      }
      if (adminCandidateResultsWorkspace && adminCandidateResultsWorkspace.candidate) {
        const selected = adminCandidateResultsWorkspace.candidate;
        const selectedName = [selected.prenom || selected['prénom'], selected.nom].filter(Boolean).join(' ').trim();
        candidateBadge.textContent = 'Résultats candidat : ' + (selectedName || 'candidat sélectionné');
        candidateBadge.hidden = false;
        return;
      }
      if (isAdminCandidatesPage()) {
        candidateBadge.textContent = 'Administration des dossiers candidats';
        candidateBadge.hidden = false;
        return;
      }
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
    const onCandidateResults = !!adminCandidateResultsWorkspace;
    const onAdminDetail = (!!adminCandidateWorkspace && onBilan) || onCandidateResults;
    bilanButton.hidden = true;
    returnButton.hidden = !adminUnlocked || !onAdminDetail;
    returnButton.textContent = 'Retour au candidat';
    exportCandidatesButton.hidden = !adminUnlocked || !editionCapabilities.canExport;
    importCandidatesButton.hidden = !adminUnlocked || !editionCapabilities.canImport;
    finishCandidateButton.hidden = true;
    closeSessionButton.hidden = !adminUnlocked;
    adminButton.textContent = adminUnlocked ? 'Verrouiller' : 'Administrateur';
    refreshCandidateBadge();
    if (adminUnlocked) {
      ipcRenderer.invoke('candidate:active').then((active) => {
        finishCandidateButton.hidden = !active;
      }).catch(() => { finishCandidateButton.hidden = true; });
    }
  };

  adminButton.addEventListener('click', async () => {
    showBar();

    if (adminUnlocked) {
      if (adminCandidateWorkspace || adminCandidateResultsWorkspace) {
        await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
      }
      // SEB_ADMIN_NAVIGATION_SAFE_LOCK
      if (adminCandidateWorkspace && isAdminBilanPage()) {
        const saved = saveNow(true);
        if (saved && saved.ok === false) {
          await showTransferMessage('Verrouillage impossible', saved.error || 'Le bilan candidat n’a pas pu être sauvegardé.', true);
          return;
        }
      }
      adminNavigationLeaving = true;
      if (adminCandidateResultsWorkspace) {
        await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
        adminCandidateResultsWorkspace = null;
      }
      if (adminCandidateWorkspace) {
        await ipcRenderer.invoke('candidate-catalog:end-bilan').catch(() => false);
        adminCandidateWorkspace = null;
      }
      await ipcRenderer.invoke('candidate:set-admin-export-context', '').catch(() => false);
      try { window.localStorage.setItem('seb_evalpro_privacy_screen', 'temporary'); } catch (_) {}
      await ipcRenderer.invoke('admin:lock');
      adminUnlocked = false;
      updateAdminButtons();
      scheduleHideBar();
      return;
    }

    const ok = await createPasswordDialog();
    if (ok) {
      const saved = saveNow(true);
      if (saved && saved.ok === false) {
        await showTransferMessage('Accès administrateur impossible', saved.error || 'La sauvegarde du parcours n’a pas pu être confirmée.', true);
        await ipcRenderer.invoke('admin:lock').catch(() => false);
        adminUnlocked = false;
        updateAdminButtons();
        scheduleHideBar();
        return;
      }
      adminUnlocked = true;
      updateAdminButtons();
      // Après déverrouillage, quitter immédiatement l'écran du parcours :
      // l'Administrateur arrive toujours sur l'écran neutre Espace administrateur.
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);
      return;
    }
    scheduleHideBar();
  });

  bilanButton.addEventListener('click', () => {
    // Aucun bilan pendant un parcours : le bilan se lance uniquement depuis la fiche candidat.
  });

  returnButton.addEventListener('click', async () => {
    if (adminCandidateResultsWorkspace || adminCandidateWorkspace) {
      await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
    }
    if (adminCandidateResultsWorkspace) {
      const candidateId = String(adminCandidateResultsWorkspace.candidateId || '');
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
      adminCandidateResultsWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId);
      return;
    }
    if (adminCandidateWorkspace) {
      const candidateId = String(adminCandidateWorkspace.candidateId || '');
      const saved = saveNow(true);
      if (saved && saved.ok === false) {
        await showTransferMessage('Retour impossible', saved.error || 'Le bilan candidat n’a pas pu être sauvegardé.', true);
        return;
      }
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-bilan').catch(() => false);
      await ipcRenderer.invoke('candidate:set-admin-export-context', '').catch(() => false);
      adminCandidateWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId);
    }
  });

  exportCandidatesButton.addEventListener('click', async () => {
    showBar();
    // SEB_ADMIN_EXPORT_REQUIRES_CLOSED_CANDIDATE
    const candidateFolderOpen = !!document.getElementById('seb-candidate-detail')
      || !!adminCandidateWorkspace
      || !!adminCandidateResultsWorkspace
      || !!document.getElementById('seb-bilan-history-editor')
      || !!document.getElementById('seb-replay-viewer');
    if (candidateFolderOpen) {
      await showTransferMessage('Export impossible', 'Fermez le dossier candidat avant de lancer l’export.', true);
      scheduleHideBar();
      return;
    }

    saveNow(true);
    exportCandidatesButton.disabled = true;
    importCandidatesButton.disabled = true;
    try {
      // SEB_ADMIN_EXPORT_FINALIZES_ACTIVE_CANDIDATE
      const activeCandidate = await ipcRenderer.invoke('candidate:active').catch(() => null);
      if (activeCandidate && String(activeCandidate.status || '') === 'EN_COURS') {
        const confirmed = await createExportCandidateFinishDialog(activeCandidate);
        if (!confirmed) return;

        const completed = await ipcRenderer.invoke('candidate:complete-active', 'admin-export').catch((error) => ({
          ok:false,
          error:String(error && error.message ? error.message : error)
        }));
        if (!completed || !completed.ok) {
          await showTransferMessage(
            'Fin de parcours impossible',
            completed && completed.error ? completed.error : 'Le parcours n’a pas pu être terminé avant l’export.',
            true
          );
          return;
        }

        finishCandidateButton.hidden = true;
        await refreshCandidateBadge();
      }

      const password = await createTransferPasswordDialog('export');
      if (!password) return;

      const destinationMode = await createExportDestinationModeDialog();
      if (!destinationMode) return;

      let newFolderName = '';
      if (destinationMode === 'create') {
        newFolderName = await createTransferNameDialog();
        if (!newFolderName) return;
      }

      const result = await ipcRenderer.invoke('admin:export-candidates', password, {
        mode:destinationMode,
        folderName:newFolderName
      });
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
        `Copie des fichiers terminée.\nVous pouvez retirer la clé USB en toute sécurité.\n\n${result.added} fichier(s) candidat chiffré(s) créé(s), ${result.skipped || 0} déjà présent(s) et ignoré(s).\n${result.verifiedFiles || 0} fichier(s) vérifié(s).\n\nClé : ${result.destinationRoot}`
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
      const password = await createTransferPasswordDialog('import');
      if (!password) return;
      const result = await ipcRenderer.invoke('admin:import-candidates', password);
      if (!result || result.cancelled) return;
      if (!result.ok) {
        await showTransferMessage('Import impossible', result.error || 'Une erreur est survenue pendant l’import.', true);
        return;
      }
      if (!result.total) {
        await showTransferMessage('Import candidats', 'Aucun fichier candidat chiffré (.seb) n’a été trouvé sur la clé sélectionnée.');
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

  finishCandidateButton.addEventListener('click', async () => {
    showBar();
    const active = await ipcRenderer.invoke('candidate:active').catch(() => null);
    if (!active) {
      finishCandidateButton.hidden = true;
      await showTransferMessage('Parcours candidat', 'Aucun parcours candidat n’est actuellement en cours sur ce PC.');
      scheduleHideBar();
      return;
    }

    const confirmed = await createCandidateFinishDialog();
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    const result = await ipcRenderer.invoke('candidate:complete-active', 'admin-manual').catch((error) => ({
      ok:false,
      error:String(error && error.message ? error.message : error)
    }));
    if (!result || !result.ok) {
      await showTransferMessage('Fin de parcours impossible', result && result.error ? result.error : 'Le parcours n’a pas pu être terminé.', true);
      scheduleHideBar();
      return;
    }

    finishCandidateButton.hidden = true;
    await showTransferMessage(
      'Parcours terminé',
      'Le parcours candidat est maintenant terminé. Il ne pourra plus être repris et son dossier est désormais exportable.'
    );
    refreshCandidateBadge();
    scheduleHideBar();
  });

  closeSessionButton.addEventListener('click', async () => {
    showBar();
    const confirmed = await createSessionCloseDialog();
    if (!confirmed) {
      scheduleHideBar();
      return;
    }

    await ipcRenderer.invoke('ai:cancel-current').catch(() => false);

    const saved = saveNow(true);
    if (saved && saved.ok === false) {
      await showTransferMessage(
        'Fermeture impossible',
        'La dernière sauvegarde du parcours n’a pas pu être confirmée. La session reste ouverte afin de ne perdre aucune donnée.',
        true
      );
      scheduleHideBar();
      return;
    }

    const closed = await ipcRenderer.invoke('admin:close-session').catch(() => false);
    if (!closed) {
      await showTransferMessage(
        'Fermeture impossible',
        'Le dossier candidat n’a pas pu être finalisé. La session reste ouverte et les données affichées sont conservées.',
        true
      );
      scheduleHideBar();
      return;
    }

    // SEB_BUILD135_REPLAY_CLOSE_GUARD
    if (replayPrototype && typeof replayPrototype.ensureFinalArchive === 'function') {
      const replayArchive = await replayPrototype.ensureFinalArchive();
      if (!replayArchive || replayArchive.ok !== true) {
        scheduleHideBar();
        return;
      }
    }

    closingSession = true;
    clearTimeout(saveTimer);
    if (periodicSaveTimer) clearInterval(periodicSaveTimer);
  });

  updateAdminButtons();
  hideBar();
}

try {
  if (isAdminCandidatesPage()) {
    restoredState = { sessionStorage:{}, localStorage:{} };
    try { window.sessionStorage.clear(); } catch (_) {}
    try { window.localStorage.clear(); } catch (_) {}
  } else if (isAdminBilanPage()) {
    const workspace = ipcRenderer.sendSync('candidate-catalog:workspace-load-sync');
    if (workspace && workspace.ok) {
      adminCandidateWorkspace = workspace;
      restoredState = workspace.state || {};
      try { window.sessionStorage.clear(); } catch (_) {}
      try { window.localStorage.clear(); } catch (_) {}
    }
  } else {
    const resultsWorkspace = ipcRenderer.sendSync('candidate-catalog:results-workspace-load-sync');
    if (resultsWorkspace && resultsWorkspace.ok) {
      adminCandidateResultsWorkspace = resultsWorkspace;
      restoredState = resultsWorkspace.state || {};
      try { window.sessionStorage.clear(); } catch (_) {}
      try { window.localStorage.clear(); } catch (_) {}
    }
  }
  if (!adminCandidateWorkspace && !adminCandidateResultsWorkspace) {
    restoredState = ipcRenderer.sendSync('state:load-sync') || {};
  }
  objectToStorage(window.sessionStorage, restoredState.sessionStorage);
  objectToStorage(window.localStorage, restoredState.localStorage);
} catch (_) {}

function showReadOnlyCandidateResults() {
  if (!adminCandidateResultsWorkspace) return;
  const page = document.getElementById('pageFinale');
  if (!page) return;
  let notice = document.getElementById('seb-admin-results-readonly');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'seb-admin-results-readonly';
    notice.textContent = 'Résultats enregistrés — lecture seule';
    notice.style.cssText = 'margin:8px 0 14px;padding:8px 12px;border:1px solid #9cc2e5;border-radius:6px;background:#f7fbff;color:#1f4e79;font:700 14px Arial,sans-serif;';
    const heading = page.querySelector('h2');
    if (heading) heading.insertAdjacentElement('afterend', notice);
    else page.prepend(notice);
  }
  const runner = document.createElement('script');
  runner.textContent = "(function(){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('visible');});var page=document.getElementById('pageFinale');if(page)page.classList.add('visible');if(typeof afficherResultat==='function')afficherResultat();window.scrollTo(0,0);})();";
  (document.documentElement || document.body).appendChild(runner);
  runner.remove();
  page.querySelectorAll('input,select,textarea,button').forEach((control) => { control.disabled = true; });

  let closeResults = document.getElementById('seb-admin-results-close');
  if (!closeResults) {
    closeResults = document.createElement('button');
    closeResults.id = 'seb-admin-results-close';
    closeResults.type = 'button';
    closeResults.textContent = 'Fermer les résultats';
    closeResults.style.cssText = 'display:block;margin:0 0 14px auto;padding:8px 14px;border:2px solid #0070c0;border-radius:6px;background:#fff;color:#0070c0;font:700 14px Arial,sans-serif;cursor:pointer;';
    closeResults.addEventListener('click', async () => {
      closeResults.disabled = true;
      await ipcRenderer.invoke('ai:cancel-current').catch(() => false);
      const candidateId = String(adminCandidateResultsWorkspace && adminCandidateResultsWorkspace.candidateId || '');
      adminNavigationLeaving = true;
      await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
      adminCandidateResultsWorkspace = null;
      await ipcRenderer.invoke('admin:return-candidate-browser', candidateId).catch(() => false);
    });
    notice.insertAdjacentElement('afterend', closeResults);
  }
}

async function completeCandidateFromFinalPage() {
  if (candidateJourneyCompleted || candidateCompletionInFlight || adminUnlocked || adminCandidateWorkspace || adminCandidateResultsWorkspace) return;
  if (isAdminCandidatesPage() || isAdminBilanPage()) return;
  const finalPage = document.getElementById('pageFinale');
  if (!finalPage) return;
  const style = window.getComputedStyle(finalPage);
  const visible = finalPage.classList.contains('visible')
    || (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0);
  if (!visible) return;

  candidateCompletionInFlight = true;
  try {
    const saved = saveNow(true);
    if (saved && saved.ok === false) return;
    const result = await ipcRenderer.invoke('candidate:complete-active', 'candidate-final-page');
    if (result && result.ok) {
      candidateJourneyCompleted = true;
      clearTimeout(saveTimer);
      if (periodicSaveTimer) clearInterval(periodicSaveTimer);
    }
  } catch (_) {
  } finally {
    candidateCompletionInFlight = false;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.setAttribute('spellcheck', 'false');
  document.querySelectorAll('input, textarea, [contenteditable]').forEach((el) => {
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
  });
  adminUnlocked = await ipcRenderer.invoke('admin:status');
  injectAdminBar();
  sebSyncAdminBarState();
  setTimeout(sebSyncAdminBarState, 80);
  setTimeout(sebSyncAdminBarState, 300);
  replayPrototype.install();
  replayNavigationCapture.install();
  bilanHistory.install();
  candidateCatalog.install({ beforeNavigate: () => saveNow(true) });
  if (adminCandidateResultsWorkspace) {
    showReadOnlyCandidateResults();
  } else {
    if (!isAdminBilanPage()) {
      document.addEventListener('input', scheduleSave, true);
      document.addEventListener('change', scheduleSave, true);
      document.addEventListener('click', scheduleSave, true);
      periodicSaveTimer = setInterval(() => saveNow(false), SAVE_CHECKPOINT_MS);
    }

    const finalPage = document.getElementById('pageFinale');
    if (finalPage && !isAdminCandidatesPage() && !isAdminBilanPage()) {
      const observer = new MutationObserver(() => { completeCandidateFromFinalPage(); });
      observer.observe(finalPage, { attributes:true, attributeFilter:['class','style'] });
      setTimeout(() => { completeCandidateFromFinalPage(); }, 0);
    }
  }
});


window.addEventListener('pageshow', async () => {
  try { adminUnlocked = await ipcRenderer.invoke('admin:status'); } catch (_) {}
  sebSyncAdminBarState();
});

window.addEventListener('beforeunload', () => {
  if (!closingSession && !adminNavigationLeaving && !isAdminCandidatesPage()) saveNow(true);
});

contextBridge.exposeInMainWorld('sebEvalPro', {
  save: () => saveNow(false),
  verifyAdminPassword: (password) => ipcRenderer.invoke('admin:verify-password', password),
  sebIaStatus: () => ipcRenderer.invoke('ai:status')
});

// SEB_PRIVACY_SCREEN_103
(function(){
  'use strict';

  const PRIVACY_KEY = 'seb_evalpro_privacy_screen';
  const MODE_TEMP = 'temporary';
  const MODE_FINAL = 'final';
  let privacyMode = '';

  function readPrivacyMode(){
    try {
      const value = String(window.localStorage.getItem(PRIVACY_KEY) || '');
      return value === MODE_TEMP || value === MODE_FINAL ? value : '';
    } catch (_) {
      return '';
    }
  }

  privacyMode = readPrivacyMode();

  // En cas de redémarrage pendant que l'écran de confidentialité était actif,
  // empêcher un flash des données avant création du voile.
  if (privacyMode) {
    try { document.documentElement.style.setProperty('visibility', 'hidden', 'important'); } catch (_) {}
  }

  function savePrivacyMode(mode){
    privacyMode = mode === MODE_TEMP || mode === MODE_FINAL ? mode : '';
    try {
      if (privacyMode) window.localStorage.setItem(PRIVACY_KEY, privacyMode);
      else window.localStorage.removeItem(PRIVACY_KEY);
    } catch (_) {}
    try { saveNow(true); } catch (_) {}
    refreshPrivacy();
  }

  function onFinalResults(){
    if (String(pageName() || '').toLowerCase() !== 'qcmv1.0.html') return false;
    const page = document.getElementById('pageFinale');
    return !!(page && page.classList.contains('visible'));
  }

  function ensurePrivacyStyle(){
    if (document.getElementById('seb-evalpro-privacy-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-evalpro-privacy-style';
    style.textContent =
      '#seb-evalpro-privacy-toggle{position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483643!important;margin:0!important;padding:10px 15px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 14px Arial,sans-serif!important;box-shadow:0 3px 12px rgba(0,0,0,.24)!important;cursor:pointer!important}' +
      '#seb-evalpro-privacy-toggle:hover{background:#005c9e!important}' +
      '#seb-evalpro-privacy-layer{position:fixed;inset:0;background:#fff;display:none;align-items:center;justify-content:center;overflow:hidden;font-family:Arial,sans-serif}' +
      '#seb-evalpro-privacy-layer img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;user-select:none;-webkit-user-drag:none}' +
      '#seb-evalpro-privacy-hide{position:absolute!important;left:50%!important;bottom:24px!important;transform:translateX(-50%)!important;margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;box-shadow:0 3px 12px rgba(0,0,0,.25)!important;cursor:pointer!important}' +
      '#seb-evalpro-final-privacy-wrap{display:flex!important;justify-content:center!important;margin:22px 0 12px!important}' +
      '#seb-evalpro-final-privacy{margin:0!important;padding:11px 20px!important;border:0!important;border-radius:8px!important;background:#0070c0!important;color:#fff!important;font:700 15px Arial,sans-serif!important;cursor:pointer!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  // SEB_ADMIN_HOME_PRIVACY_BUTTON_IN_BAR
  function placePrivacyToggleForAdminHome(button){
    if (!button) return button;
    const onAdminHome = typeof isAdminCandidatesPage === 'function' && isAdminCandidatesPage();
    if (!onAdminHome) return button;
    const bar = document.getElementById('seb-evalpro-topbar');
    if (!bar) return button;
    if (button.parentElement !== bar) bar.appendChild(button);
    const centered = {
      position:'absolute', left:'50%', right:'auto', bottom:'auto', top:'50%',
      transform:'translate(-50%, -50%)', zIndex:'2147483647', margin:'0',
      padding:'6px 12px', border:'2px solid #0070c0', borderRadius:'6px',
      background:'#fff', color:'#0070c0', whiteSpace:'nowrap',
      font:'700 14px Arial, sans-serif', boxShadow:'0 2px 5px rgba(0,0,0,.18)'
    };
    Object.entries(centered).forEach(([name, value]) => {
      const cssName = name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
      button.style.setProperty(cssName, value, 'important');
    });
    return button;
  }

  function ensurePrivacyToggle(){
    let button = document.getElementById('seb-evalpro-privacy-toggle');
    if (button) return placePrivacyToggleForAdminHome(button);
    button = document.createElement('button');
    button.id = 'seb-evalpro-privacy-toggle';
    button.type = 'button';
    button.textContent = 'Afficher l’écran d’accueil';
    button.addEventListener('click', function(){
      savePrivacyMode(MODE_TEMP);
    });
    document.body.appendChild(button);
    return placePrivacyToggleForAdminHome(button);
  }

  function ensurePrivacyLayer(){
    let layer = document.getElementById('seb-evalpro-privacy-layer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'seb-evalpro-privacy-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');

    const image = document.createElement('img');
    image.src = 'imageqcm/seb-evalpro-privacy-screen.jpg';
    image.alt = 'SEB-éval-PRO';
    image.draggable = false;

    const hide = document.createElement('button');
    hide.id = 'seb-evalpro-privacy-hide';
    hide.type = 'button';
    hide.textContent = 'Masquer l’écran d’accueil';
    hide.addEventListener('click', function(){
      if (privacyMode === MODE_TEMP) savePrivacyMode('');
    });

    layer.appendChild(image);
    layer.appendChild(hide);
    document.body.appendChild(layer);
    return layer;
  }

  function ensureFinalPrivacyButton(){
    if (String(pageName() || '').toLowerCase() !== 'qcmv1.0.html') return null;
    const page = document.getElementById('pageFinale');
    if (!page) return null;

    let wrap = document.getElementById('seb-evalpro-final-privacy-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'seb-evalpro-final-privacy-wrap';

      const button = document.createElement('button');
      button.id = 'seb-evalpro-final-privacy';
      button.type = 'button';
      button.textContent = 'Revenir à l’écran SEB-éval-PRO';
      button.addEventListener('click', function(){
        savePrivacyMode(MODE_FINAL);
      });

      wrap.appendChild(button);
      page.appendChild(wrap);
    }
    return wrap;
  }

  function refreshPrivacy(){
    if (!document.body) return;

    const adminPage = isAdminBilanPage();
    const toggle = ensurePrivacyToggle();
    const layer = ensurePrivacyLayer();
    const hide = layer.querySelector('#seb-evalpro-privacy-hide');
    const finalWrap = ensureFinalPrivacyButton();
    const finalResults = onFinalResults();

    if (adminPage) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.setProperty('display', 'none', 'important');
      if (finalWrap) finalWrap.style.setProperty('display', 'none', 'important');
      document.documentElement.style.removeProperty('visibility');
      return;
    }

    if (finalWrap) {
      finalWrap.style.setProperty('display', finalResults && privacyMode !== MODE_FINAL ? 'flex' : 'none', 'important');
    }

    if (privacyMode === MODE_TEMP) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483647';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'block', 'important');
      hide.setAttribute('aria-hidden', 'false');
    } else if (privacyMode === MODE_FINAL && !adminUnlocked) {
      toggle.style.setProperty('display', 'none', 'important');
      layer.style.zIndex = '2147483644';
      layer.style.setProperty('display', 'flex', 'important');
      hide.style.setProperty('display', 'none', 'important');
      hide.setAttribute('aria-hidden', 'true');
    } else {
      layer.style.setProperty('display', 'none', 'important');
      hide.style.setProperty('display', 'none', 'important');
      toggle.style.setProperty('display', (String(pageName() || '').toLowerCase() === 'introbrique.html' || finalResults) ? 'none' : 'block', 'important');
    }

    document.documentElement.style.removeProperty('visibility');
  }

  function startPrivacy(){
    if (!document.body) return;
    ensurePrivacyStyle();
    refreshPrivacy();

    const observer = new MutationObserver(function(){
      setTimeout(refreshPrivacy, 0);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    document.addEventListener('click', function(event){
      const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
      if (!admin) return;
      setTimeout(refreshPrivacy, 0);
      setTimeout(refreshPrivacy, 250);
    }, true);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', function(){
      // injectAdminBar() est asynchrone au démarrage; un court délai permet de
      // récupérer aussi le statut Administrateur avant le premier rafraîchissement.
      setTimeout(startPrivacy, 0);
    }, { once: true });
  } else {
    setTimeout(startPrivacy, 0);
  }
})();


// SEB_LOCAL_AI_ADMIN_BAR_FAILSAFE
function sebLocalAiEnsureAdminBar() {
  try {
    if (document.body) injectAdminBar();
  } catch (error) {
    console.error('SEB EvalPro: impossible d’injecter la barre Administrateur', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', sebLocalAiEnsureAdminBar, { once: true });
} else {
  sebLocalAiEnsureAdminBar();
}
setTimeout(sebLocalAiEnsureAdminBar, 250);
